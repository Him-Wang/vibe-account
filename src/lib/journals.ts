import type { JournalBook, JournalPage } from "../types";
import { collection } from "./db";

export const COVER_COLORS = [
  "#DCC9F4",
  "#C6E7D4",
  "#C9DCF7",
  "#FFE3A6",
  "#E8DDF6",
  "#D8E6DA",
];

const books = collection<JournalBook>("journalBooks");
const pages = collection<JournalPage>("journals");

function refreshCount(bookId: string): void {
  const count = pages.all().filter((p) => p.bookId === bookId && !p.deleted).length;
  books.patch(bookId, { pageCount: count });
}

export const journalService = {
  listBooks(): JournalBook[] {
    let rows = books.all().filter((b) => !b.deleted);
    if (rows.length === 0) {
      this.createBook("我的第一本贴册");
      rows = books.all().filter((b) => !b.deleted);
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getBook(id: string): JournalBook | undefined {
    const book = books.get(id);
    return book && !book.deleted ? book : undefined;
  },

  createBook(title: string): JournalBook {
    const coverColor = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];
    return books.insert({
      title: title.trim() || "未命名贴册",
      coverColor,
      pageCount: 0,
      deleted: false,
      createdAt: new Date().toISOString(),
    });
  },

  removeBook(id: string): void {
    books.patch(id, { deleted: true });
  },

  listPages(bookId: string): JournalPage[] {
    return pages
      .all()
      .filter((p) => p.bookId === bookId && !p.deleted)
      .sort((a, b) => a.index - b.index);
  },

  getPage(id: string): JournalPage | undefined {
    const page = pages.get(id);
    return page && !page.deleted ? page : undefined;
  },

  createPage(
    bookId: string,
    data: Pick<JournalPage, "index" | "width" | "height" | "background" | "elements">
  ): JournalPage {
    const now = new Date().toISOString();
    const page = pages.insert({
      ...data,
      bookId,
      date: now.slice(0, 10),
      status: "done",
      deleted: false,
      createdAt: now,
      updatedAt: now,
    });
    refreshCount(bookId);
    return page;
  },

  updatePage(
    id: string,
    patch: Partial<Pick<JournalPage, "background" | "elements" | "width" | "height">>
  ): JournalPage | undefined {
    const updated = pages.patch(id, { ...patch, updatedAt: new Date().toISOString() });
    if (updated) refreshCount(updated.bookId);
    return updated;
  },

  removePage(id: string): void {
    const page = pages.get(id);
    if (!page) return;
    pages.patch(id, { deleted: true, updatedAt: new Date().toISOString() });
    refreshCount(page.bookId);
  },

  pageCount(bookId: string): number {
    return this.listPages(bookId).length;
  },
};
