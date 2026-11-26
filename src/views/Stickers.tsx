import { useState } from "react";
import { stickerService } from "../lib/stickers";
import { confirmDialog, toast } from "../lib/ui";
import { Empty, NavBar } from "../components/ui";
import { StickerIcon } from "../components/icons";

export default function Stickers() {
  const [version, setVersion] = useState(0);
  const list = stickerService.list();
  const [preview, setPreview] = useState<string | null>(null);

  const remove = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `删除「${name}」？`,
      content: "账目不受影响，只是这张贴纸没了。",
      danger: true,
      confirmText: "删除",
    });
    if (!ok) return;
    stickerService.remove(id);
    toast("已删除");
    setVersion((v) => v + 1);
  };

  return (
    <div className="page" data-version={version}>
      <NavBar title="图鉴" sub="拍物时自动收进来" />

      {list.length === 0 ? (
        <Empty icon={<StickerIcon size={26} />} text="图鉴还空着，去拍一件试试" />
      ) : (
        <div className="sticker-grid">
          {list.map((s) => (
            <button key={s._id} className="sticker-cell" onClick={() => setPreview(s.thumbFileId || "")}>
              {s.thumbFileId ? (
                <img src={s.thumbFileId} alt={s.name} />
              ) : (
                <span className="sticker-emoji">📦</span>
              )}
              <small>{s.name}</small>
              <span
                className="sticker-del"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(s._id, s.name);
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      {preview && (
        <div className="overlay" onClick={() => setPreview(null)}>
          <img className="sticker-preview" src={preview} alt="贴纸预览" />
        </div>
      )}
    </div>
  );
}
