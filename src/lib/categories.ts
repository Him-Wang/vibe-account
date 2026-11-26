import type { Category, CategoryKind } from "../types";
import { collection } from "./db";
import { DEFAULT_CATEGORIES } from "./mock";

const categories = collection<Category>("categories");

function seedIfEmpty(kind: CategoryKind): void {
  const existing = categories.all().filter((c) => c.kind === kind && !c.hidden);
  if (existing.length > 0) return;
  const rows = categories.all();
  for (const def of DEFAULT_CATEGORIES.filter((d) => d.kind === kind)) {
    if (rows.some((r) => r.kind === kind && r.name === def.name)) continue;
    rows.push({ ...def, _id: `cat-${kind}-${def.sort}`, isSystem: true, hidden: false });
  }
  categories.write(rows);
}

export const categoryService = {
  ensureSeeded(): void {
    seedIfEmpty("product");
    seedIfEmpty("date");
  },

  list(kind: CategoryKind = "product"): Category[] {
    seedIfEmpty(kind);
    return categories
      .all()
      .filter((c) => c.kind === kind && !c.hidden)
      .sort((a, b) => a.sort - b.sort);
  },

  get(id: string): Category | undefined {
    return categories.get(id);
  },

  create(kind: CategoryKind, name: string, icon = "📦", color = "#E86A4A"): Category {
    const rows = categories.all().filter((c) => c.kind === kind);
    const sort = rows.reduce((max, c) => Math.max(max, c.sort), 0) + 1;
    return categories.insert({ kind, name, icon, color, sort, isSystem: false, hidden: false });
  },

  rename(id: string, name: string): void {
    categories.patch(id, { name });
  },

  remove(id: string): void {
    categories.patch(id, { hidden: true });
  },
};
