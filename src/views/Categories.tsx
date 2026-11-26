import { useState } from "react";
import { categoryService } from "../lib/categories";
import { confirmDialog, promptDialog, toast } from "../lib/ui";
import { NavBar, Segmented } from "../components/ui";
import type { CategoryKind } from "../types";

export default function Categories() {
  const [kind, setKind] = useState<CategoryKind>("product");
  const [version, setVersion] = useState(0);
  const list = categoryService.list(kind);

  const refresh = () => setVersion((v) => v + 1);

  const add = async () => {
    const name = await promptDialog({
      title: "新标签名称",
      placeholder: kind === "product" ? "例如：宠物" : "例如：出差",
    });
    if (!name) return;
    categoryService.create(kind, name, kind === "product" ? "📦" : "🏷️");
    toast("已添加");
    refresh();
  };

  const rename = async (id: string, current: string) => {
    const name = await promptDialog({ title: "改个名字", value: current });
    if (!name || name === current) return;
    categoryService.rename(id, name);
    refresh();
  };

  const remove = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `删除「${name}」？`,
      content: "已有账单里的分类名不会改变。",
      danger: true,
      confirmText: "删除",
    });
    if (!ok) return;
    categoryService.remove(id);
    toast("已删除");
    refresh();
  };

  return (
    <div className="page" data-version={version}>
      <NavBar title="标签册" sub="记账用的标签，也管贴页上的日期" />

      <Segmented
        value={kind}
        onChange={(v) => setKind(v)}
        options={[
          { value: "product", label: "记账标签" },
          { value: "date", label: "日期" },
        ]}
      />

      <div className="card list">
        {list.map((cat) => (
          <div className="cat-row" key={cat._id}>
            <span className="bill-icon" style={{ background: cat.color + "26", color: cat.color }}>
              {cat.icon}
            </span>
            <button className="cat-name" onClick={() => rename(cat._id, cat.name)}>
              {cat.name}
              {cat.isSystem && <small>系统</small>}
            </button>
            <button className="icon-btn tiny" onClick={() => remove(cat._id, cat.name)} aria-label="删除">
              ×
            </button>
          </div>
        ))}
      </div>

      <button className="btn block ghost" onClick={add}>
        ＋ 新增{kind === "product" ? "分类" : "标签"}
      </button>
      <p className="muted small center">点名字可以改名，× 删除。</p>
    </div>
  );
}
