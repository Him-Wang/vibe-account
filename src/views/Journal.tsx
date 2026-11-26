import { useState } from "react";
import { journalService } from "../lib/journals";
import { navigate } from "../lib/router";
import { promptDialog, toast } from "../lib/ui";
import { NavBar } from "../components/ui";

export default function Journal() {
  const [version, setVersion] = useState(0);
  const books = journalService.listBooks();

  const create = async () => {
    const title = await promptDialog({
      title: "给这本手账起个名字",
      placeholder: "例如：十一月的小日子",
    });
    if (!title) return;
    const book = journalService.createBook(title);
    toast("手账本建好了");
    setVersion((v) => v + 1);
    navigate(`/journal/${book._id}`);
  };

  return (
    <div className="page" data-version={version}>
      <NavBar
        title="手账"
        sub="把账单贴纸贴进纸里"
        showBack={false}
        right={
          <button className="icon-link" onClick={create}>
            ＋新建
          </button>
        }
      />

      <div className="book-grid">
        {books.map((book) => (
          <button
            key={book._id}
            className="book"
            style={{ background: `linear-gradient(160deg, ${book.coverColor}, ${book.coverColor}cc)` }}
            onClick={() => navigate(`/journal/${book._id}`)}
          >
            <span className="book-spine" />
            <strong>{book.title}</strong>
            <small>{book.pageCount} 页</small>
          </button>
        ))}
        <button className="book new" onClick={create}>
          <span>＋</span>
          <small>新建手账本</small>
        </button>
      </div>

      <p className="muted small center">手账页保存在本机浏览器，随时可以导出成图片。</p>
    </div>
  );
}
