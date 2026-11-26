import { type ReactNode, useEffect } from "react";
import { back, navigate } from "../lib/router";

export function NavBar({
  title,
  sub,
  showBack = true,
  right,
}: {
  title: string;
  sub?: string;
  showBack?: boolean;
  right?: ReactNode;
}) {
  return (
    <header className="navbar">
      {showBack && (
        <button className="icon-btn" onClick={() => back()} aria-label="返回">
          ‹
        </button>
      )}
      <div className="navbar-title">
        <strong>{title}</strong>
        {sub && <small>{sub}</small>}
      </div>
      <div className="navbar-right">{right}</div>
    </header>
  );
}

export function Empty({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {title && <h3 className="sheet-title">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? "seg active" : "seg"}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export function Stepper({
  value,
  min = 1,
  onChange,
}: {
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="减少">
        −
      </button>
      <span>{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label="增加">
        +
      </button>
    </div>
  );
}

export function GoRow({
  icon,
  title,
  desc,
  to,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  to?: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="go-row"
      onClick={() => {
        if (onClick) onClick();
        if (to) navigate(to);
      }}
    >
      <span className="go-icon">{icon}</span>
      <span className="go-text">
        <strong>{title}</strong>
        {desc && <small>{desc}</small>}
      </span>
      <span className="go-arrow">›</span>
    </button>
  );
}
