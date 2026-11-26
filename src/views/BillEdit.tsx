import { useEffect, useMemo, useState } from "react";
import { billService } from "../lib/bills";
import { categoryService } from "../lib/categories";
import { fenToYuan, today, yuanToFen } from "../lib/format";
import { back, useRoute, match } from "../lib/router";
import { toast } from "../lib/ui";
import { Field, NavBar, Sheet } from "../components/ui";
import type { Category } from "../types";

export default function BillEdit() {
  const route = useRoute();
  const params = match("/bills/edit/:id", route.path);
  const id = params?.id;
  const existing = id ? billService.get(id) : undefined;

  const categories = useMemo(() => categoryService.list("product"), []);
  const [amount, setAmount] = useState(existing ? String(fenToYuan(existing.amount)) : "");
  const [date, setDate] = useState(existing?.date || today());
  const [note, setNote] = useState(existing?.note || "");
  const [merchant, setMerchant] = useState(existing?.merchant || "");
  const [category, setCategory] = useState<Category | undefined>(() => {
    if (existing) return categories.find((c) => c._id === existing.categoryId);
    return categories[0];
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!category) setCategory(categories[0]);
  }, [category, categories]);

  const save = () => {
    if (!existing && !id) {
      // creating
    }
    const cents = yuanToFen(Number(amount));
    if (!Number.isFinite(cents) || cents <= 0) {
      toast("金额要大于 0");
      return;
    }
    if (!category) {
      toast("先选一个分类");
      return;
    }
    if (existing) {
      billService.update(existing._id, {
        amount: cents,
        date,
        merchant,
        note,
        categoryId: category._id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
      });
    } else {
      billService.create({
        amount: cents,
        date,
        merchant,
        note,
        categoryId: category._id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
        source: "manual",
      });
    }
    toast("已保存");
    window.setTimeout(() => back(), 320);
  };

  return (
    <div className="page">
      <NavBar
        title={existing ? "编辑账单" : "手动记账"}
        right={
          <button className="btn sm primary" onClick={save}>
            保存
          </button>
        }
      />

      <section className="amount-card card">
        <label className="amount-label">金额（元）</label>
        <input
          className="amount-input"
          value={amount}
          inputMode="decimal"
          autoFocus
          placeholder="0.00"
          onChange={(e) => setAmount(e.target.value)}
        />
      </section>

      <section className="card form">
        <button className="field field-button" onClick={() => setPickerOpen(true)}>
          <span className="field-label">分类</span>
          <span className="field-value">
            {category ? (
              <>
                <span
                  className="bill-icon sm"
                  style={{ background: category.color + "26", color: category.color }}
                >
                  {category.icon}
                </span>
                {category.name}
              </>
            ) : (
              "选择分类"
            )}
            <span className="go-arrow">›</span>
          </span>
        </button>

        <Field label="日期">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="备注">
          <input
            className="input"
            value={note}
            placeholder="例如：和同事吃午饭"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        <Field label="商家（可选）">
          <input
            className="input"
            value={merchant}
            placeholder="例如：楼下面馆"
            onChange={(e) => setMerchant(e.target.value)}
          />
        </Field>
      </section>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="选择分类">
        <div className="cat-grid">
          {categories.map((c) => (
            <button
              key={c._id}
              className={category?._id === c._id ? "cat-cell active" : "cat-cell"}
              onClick={() => {
                setCategory(c);
                setPickerOpen(false);
              }}
            >
              <span className="cat-cell-icon" style={{ background: c.color + "26", color: c.color }}>
                {c.icon}
              </span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
