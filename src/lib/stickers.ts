import type { Sticker } from "../types";
import { collection } from "./db";

const stickers = collection<Sticker>("stickers");

export interface NewSticker {
  name: string;
  originalFileId?: string;
  cutoutFileId?: string;
  animeFileId?: string;
  thumbFileId?: string;
  categoryName?: string;
  billId?: string;
}

export const stickerService = {
  list(): Sticker[] {
    return stickers
      .all()
      .filter((s) => !s.deleted)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  add(data: NewSticker): Sticker {
    return stickers.insert({
      name: data.name,
      originalFileId: data.originalFileId || "",
      cutoutFileId: data.cutoutFileId || "",
      animeFileId: data.animeFileId || "",
      thumbFileId: data.thumbFileId || "",
      categoryName: data.categoryName || "",
      billId: data.billId || "",
      isBuiltin: false,
      deleted: false,
      createdAt: new Date().toISOString(),
    });
  },

  remove(id: string): void {
    stickers.patch(id, { deleted: true });
  },
};
