import { genId, loadCollection, saveCollection } from "./storage";

export interface Row {
  _id: string;
}

export interface Collection<T extends Row> {
  all(): T[];
  write(rows: T[]): void;
  get(id: string): T | undefined;
  insert(data: Omit<T, "_id">, prefix?: string): T;
  patch(id: string, patch: Partial<T>): T | undefined;
  remove(id: string): void;
}

/**
 * Tiny localStorage backed collection. Every write re-reads the current rows so
 * two components touching the same collection cannot clobber each other.
 */
export function collection<T extends Row>(name: string): Collection<T> {
  const all = () => loadCollection<T>(name);
  const write = (rows: T[]) => saveCollection(name, rows);
  return {
    all,
    write,
    get: (id) => all().find((r) => r._id === id),
    insert(data, prefix = "") {
      const row = { ...data, _id: prefix + genId() } as T;
      const rows = all();
      rows.push(row);
      write(rows);
      return row;
    },
    patch(id, patch) {
      const rows = all();
      const i = rows.findIndex((r) => r._id === id);
      if (i < 0) return undefined;
      rows[i] = { ...rows[i], ...patch };
      write(rows);
      return rows[i];
    },
    remove(id) {
      write(all().filter((r) => r._id !== id));
    },
  };
}
