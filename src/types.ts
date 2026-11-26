export type BillSource = "voice" | "manual" | "receipt" | "product";

export interface BillItem {
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

/** A single expense record. `amount` is in cents. */
export interface Bill {
  _id: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  merchant?: string;
  note: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  source: BillSource;
  items: BillItem[];
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CategoryKind = "product" | "date";

export interface Category {
  _id: string;
  kind: CategoryKind;
  name: string;
  icon: string;
  color: string;
  sort: number;
  isSystem: boolean;
  hidden: boolean;
}

export interface Sticker {
  _id: string;
  name: string;
  originalFileId: string;
  cutoutFileId: string;
  animeFileId: string;
  thumbFileId: string;
  categoryName: string;
  billId: string;
  isBuiltin: boolean;
  deleted: boolean;
  createdAt: string;
}

export interface JournalBook {
  _id: string;
  title: string;
  coverColor: string;
  pageCount: number;
  deleted: boolean;
  createdAt: string;
}

export interface StickerElement {
  _id: string;
  type: "sticker";
  x: number;
  y: number;
  w: number;
  h: number;
  emoji: string;
  fileId: string;
  zIndex: number;
}

export interface TextElement {
  _id: string;
  type: "text";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  fontSize: number;
  zIndex: number;
}

export interface DrawElement {
  _id: string;
  type: "draw";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  points: { x: number; y: number }[];
  zIndex: number;
}

export type PageElement = StickerElement | TextElement | DrawElement;

export interface PageBackground {
  type: "color";
  value: string;
}

export interface JournalPage {
  _id: string;
  bookId: string;
  index: number;
  width: number;
  height: number;
  background: PageBackground;
  elements: PageElement[];
  date: string;
  status: "done";
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AiMockMode = "auto" | "fail" | "timeout";

export interface Settings {
  baseUrl: string;
  model: string;
  apiKey: string;
  glass: boolean;
  aiMockMode: AiMockMode;
  /** 视觉模型：留空 key 就只用本地 OCR */
  visionPreset: string;
  visionBaseUrl: string;
  visionModel: string;
  visionApiKey: string;
  /** 录音转写：留空 key 就用浏览器自带语音识别 */
  asrPreset: string;
  asrBaseUrl: string;
  asrModel: string;
  asrApiKey: string;
  /** 图片生成：配置后才真正生成动漫/油画等画风 */
  imagePreset: string;
  imageBaseUrl: string;
  imageModel: string;
  imageApiKey: string;
}

export interface OcrItem {
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface OcrResult {
  rawText: string;
  parsed: {
    merchant: string;
    date: string;
    items: OcrItem[];
    totalAmount: number;
  };
  confidence: number;
  provider: string;
}

export interface SegmentResult {
  cutoutFileId: string;
  whiteBorder: boolean;
  provider: string;
}

export interface AnimeResult {
  animeFileId: string;
  style: string;
  provider: string;
}

export interface FlowState {
  mode: "receipt" | "product";
  imagePaths: string[];
  builtin: BuiltinProduct | null;
  ocr: OcrResult | null;
  segment: SegmentResult | null;
  anime: AnimeResult | null;
}

export interface BuiltinProduct {
  name: string;
  emoji: string;
  categoryName: string;
  price: number;
  color: string;
}
