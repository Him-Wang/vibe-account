import type { Bill, BillSource } from "../types";
import { collection } from "./db";

export interface NewBill {
  amount: number;
  date: string;
  merchant?: string;
  note?: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  source?: BillSource;
  items?: Bill["items"];
}

const bills = collection<Bill>("bills");

function stamp(): string {
  return new Date().toISOString();
}

export const billService = {
  list(month?: string): Bill[] {
    return bills
      .all()
      .filter((b) => !b.deleted && (!month || b.date.startsWith(month)))
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  },

  all(): Bill[] {
    return bills.all().filter((b) => !b.deleted);
  },

  get(id: string): Bill | undefined {
    const bill = bills.get(id);
    return bill && !bill.deleted ? bill : undefined;
  },

  create(data: NewBill): Bill {
    const now = stamp();
    return bills.insert({
      amount: Math.max(0, Math.round(data.amount)),
      date: data.date,
      merchant: data.merchant || "",
      note: data.note || "",
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      categoryIcon: data.categoryIcon,
      categoryColor: data.categoryColor,
      source: data.source || "manual",
      items: data.items || [],
      deleted: false,
      createdAt: now,
      updatedAt: now,
    });
  },

  update(id: string, patch: Partial<NewBill>): Bill | undefined {
    return bills.patch(id, { ...patch, updatedAt: stamp() } as Partial<Bill>);
  },

  remove(id: string): void {
    bills.patch(id, { deleted: true, updatedAt: stamp() });
  },

  monthSummary(month: string): { total: number; count: number } {
    const rows = this.list(month);
    return {
      total: rows.reduce((sum, b) => sum + b.amount, 0),
      count: rows.length,
    };
  },

  dayTotal(date: string): number {
    return billService
      .all()
      .filter((b) => b.date === date)
      .reduce((sum, b) => sum + b.amount, 0);
  },

  grandTotal(): number {
    return billService.all().reduce((sum, b) => sum + b.amount, 0);
  },

  grouped(month: string): { date: string; items: Bill[]; total: number }[] {
    const map = new Map<string, Bill[]>();
    for (const bill of this.list(month)) {
      const list = map.get(bill.date) || [];
      list.push(bill);
      map.set(bill.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({ date, items, total: items.reduce((s, b) => s + b.amount, 0) }));
  },
};
