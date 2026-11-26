const PREFIX = "vibe-account:v1:";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded — keep the in-memory copy working */
  }
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function loadCollection<T>(name: string): T[] {
  return read<T[]>(name, []);
}

export function saveCollection<T>(name: string, rows: T[]): void {
  write(name, rows);
}

export function readKey<T>(key: string, fallback: T): T {
  return read<T>(key, fallback);
}

export function writeKey<T>(key: string, value: T): void {
  write(key, value);
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function clearCollections(names: string[]): void {
  for (const name of names) {
    try {
      localStorage.removeItem(PREFIX + name);
    } catch {
      /* ignore */
    }
  }
}
