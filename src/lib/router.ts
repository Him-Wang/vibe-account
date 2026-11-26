import { useEffect, useSyncExternalStore } from "react";

export interface RouteState {
  path: string;
  query: URLSearchParams;
  hash: string;
}

function parseHash(): RouteState {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const qIndex = raw.indexOf("?");
  const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : "");
  return { path: path || "/", query, hash: raw };
}

let current = parseHash();
const listeners = new Set<() => void>();

function emit() {
  current = parseHash();
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", emit);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useRoute(): RouteState {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

export function navigate(to: string): void {
  const next = to.startsWith("#") ? to : "#" + to;
  if (window.location.hash === next) {
    emit();
    return;
  }
  window.location.hash = next;
}

export function back(): void {
  if (window.history.length > 1) window.history.back();
  else navigate("/");
}

export function replace(to: string): void {
  const next = to.startsWith("#") ? to : "#" + to;
  const url = window.location.pathname + window.location.search + next;
  window.history.replaceState(null, "", url);
  emit();
}

/** Match "/bills/:id" style patterns. Returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

/** Scroll the app content back to top whenever the path changes. */
export function useScrollTopOnRoute(): void {
  const route = useRoute();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.path]);
}
