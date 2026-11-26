import { useEffect, useRef, useSyncExternalStore } from "react";

type ToastState = { id: number; text: string } | null;

export interface ModalState {
  type: "confirm" | "prompt";
  title: string;
  content: string;
  value: string;
  placeholder: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
}

interface UiState {
  toast: ToastState;
  modal: ModalState | null;
}

let state: UiState = { toast: null, modal: null };
const listeners = new Set<() => void>();
let toastSeq = 0;
let toastTimer: number | undefined;
let resolver: ((value: boolean | string | null) => void) | null = null;

function emit(next: UiState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function toast(text: string): void {
  toastSeq += 1;
  emit({ ...state, toast: { id: toastSeq, text } });
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    emit({ ...state, toast: null });
  }, 2400);
}

export function confirmDialog(opts: {
  title: string;
  content?: string;
  danger?: boolean;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    resolver = (v) => resolve(v === true);
    emit({
      ...state,
      modal: {
        type: "confirm",
        title: opts.title,
        content: opts.content || "",
        value: "",
        placeholder: "",
        confirmText: opts.confirmText || "确定",
        cancelText: opts.cancelText || "取消",
        danger: !!opts.danger,
      },
    });
  });
}

export function promptDialog(opts: {
  title: string;
  value?: string;
  placeholder?: string;
  confirmText?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    resolver = (v) => resolve(typeof v === "string" ? v : null);
    emit({
      ...state,
      modal: {
        type: "prompt",
        title: opts.title,
        content: "",
        value: opts.value || "",
        placeholder: opts.placeholder || "",
        confirmText: opts.confirmText || "确定",
        cancelText: "取消",
        danger: false,
      },
    });
  });
}

export function setModalValue(value: string): void {
  if (!state.modal) return;
  emit({ ...state, modal: { ...state.modal, value } });
}

export function closeModal(result: boolean | string): void {
  const r = resolver;
  resolver = null;
  emit({ ...state, modal: null });
  if (r) r(result);
}

export function useUi(): UiState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function UiHost() {
  const ui = useUi();
  const inputRef = useRef<HTMLInputElement>(null);
  const modal = ui.modal;

  useEffect(() => {
    if (modal && modal.type === "prompt") {
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [modal]);

  return (
    <>
      {ui.toast && <div className="toast glass" key={ui.toast.id}>{ui.toast.text}</div>}
      {modal && (
        <div className="overlay" onClick={() => closeModal(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.title}</h3>
            {modal.type === "confirm" ? (
              <p className="modal-sub">{modal.content}</p>
            ) : (
              <input
                ref={inputRef}
                className="modal-input"
                value={modal.value}
                placeholder={modal.placeholder}
                onChange={(e) => setModalValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") closeModal(modal.value.trim());
                }}
              />
            )}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => closeModal(false)}>
                {modal.cancelText}
              </button>
              <button
                className={"btn " + (modal.danger ? "danger" : "primary")}
                onClick={() => closeModal(modal.type === "prompt" ? modal.value.trim() : true)}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
