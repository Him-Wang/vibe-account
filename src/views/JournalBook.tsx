import { useEffect, useRef, useState } from "react";
import { journalService } from "../lib/journals";
import { match, navigate, useRoute } from "../lib/router";
import { confirmDialog, toast } from "../lib/ui";
import { Empty, NavBar } from "../components/ui";
import { JournalIcon } from "../components/icons";

export default function JournalBook() {
  const route = useRoute();
  const bookId = match("/journal/:bookId", route.path)?.bookId || "";
  const [version, setVersion] = useState(0);
  const book = journalService.getBook(bookId);
  const pages = journalService.listPages(bookId);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!book) {
      toast("这本贴册不见了");
      navigate("/journal");
    }
  }, [book]);

  if (!book) return null;

  const removePage = async (id: string, index: number) => {
    const ok = await confirmDialog({
      title: `删除第 ${index + 1} 页？`,
      content: "这一页的贴纸和笔画会一起删除。",
      danger: true,
      confirmText: "删除",
    });
    if (!ok) return;
    journalService.removePage(id);
    toast("已删除这一页");
    setVersion((v) => v + 1);
  };

  return (
    <div className="page" data-version={version}>
      <NavBar title={book.title} sub={`共 ${pages.length} 页 · 长按可以撕掉`} />

      {pages.length === 0 ? (
        <Empty
          icon={<JournalIcon size={26} />}
          text="这一本还空着"
          action={
            <button className="btn primary" onClick={() => navigate(`/journal/editor?bookId=${bookId}`)}>
              贴第一页
            </button>
          }
        />
      ) : (
        <div className="page-grid">
          <button
            className="page-cell new"
            onClick={() => navigate(`/journal/editor?bookId=${bookId}`)}
          >
            <span>＋</span>
            <small>新贴页</small>
          </button>

          {pages.map((page) => (
            <button
              key={page._id}
              className="page-cell"
              style={{ background: page.background.value }}
              onPointerDown={() => {
                window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => removePage(page._id, page.index), 600);
              }}
              onPointerUp={() => window.clearTimeout(timer.current)}
              onPointerLeave={() => window.clearTimeout(timer.current)}
              onContextMenu={(e) => {
                e.preventDefault();
                removePage(page._id, page.index);
              }}
              onClick={() => navigate(`/journal/editor?bookId=${bookId}&pageId=${page._id}`)}
            >
              <span className="page-no">P{page.index + 1}</span>
              <span className="page-meta">{page.elements.length} 个元素</span>
              <small>{page.date}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
