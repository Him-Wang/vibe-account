import { useEffect, useState } from "react";
import { billService } from "../lib/bills";
import { formatFen } from "../lib/format";
import { back, match, navigate, useRoute } from "../lib/router";
import { confirmDialog, toast } from "../lib/ui";
import { NavBar } from "../components/ui";
import type { Bill } from "../types";

export default function BillDetail() {
  const route = useRoute();
  const id = match("/bills/:id", route.path)?.id;
  const [bill, setBill] = useState<Bill | undefined>(() => (id ? billService.get(id) : undefined));

  useEffect(() => {
    const next = id ? billService.get(id) : undefined;
    if (!next) {
      toast("这一笔不见了");
      navigate("/bills");
      return;
    }
    setBill(next);
  }, [id]);

  if (!bill) return null;

  const remove = async () => {
    const ok = await confirmDialog({
      title: "删掉这一笔？",
      content: "删除后不可恢复。",
      danger: true,
      confirmText: "删除",
    });
    if (!ok) return;
    billService.remove(bill._id);
    toast("已删除");
    back();
  };

  return (
    <div className="page">
      <NavBar
        title="这笔账"
        right={
          <button className="icon-link" onClick={() => navigate(`/bills/edit/${bill._id}`)}>
            编辑
          </button>
        }
      />

      <section className="detail-hero card">
        <span
          className="bill-icon lg"
          style={{ background: bill.categoryColor + "26", color: bill.categoryColor }}
        >
          {bill.categoryIcon}
        </span>
        <p className="detail-cat">{bill.categoryName}</p>
        <div className="detail-amount">-¥{formatFen(bill.amount)}</div>
        <p className="detail-note">{bill.note || bill.merchant || "一笔支出"}</p>
        <span className="pill">
          {bill.source === "voice"
            ? "说一句"
            : bill.source === "receipt"
              ? "扫票"
              : bill.source === "product"
                ? "拍物"
                : "手记"}
        </span>
      </section>

      <section className="card form">
        <div className="kv">
          <span>日期</span>
          <strong>{bill.date}</strong>
        </div>
        {bill.merchant && (
          <div className="kv">
            <span>商家</span>
            <strong>{bill.merchant}</strong>
          </div>
        )}
        <div className="kv">
          <span>备注</span>
          <strong>{bill.note || "—"}</strong>
        </div>
        <div className="kv">
          <span>记录时间</span>
          <strong>{new Date(bill.createdAt).toLocaleString("zh-CN")}</strong>
        </div>
      </section>

      {bill.items.length > 0 && (
        <section className="card">
          <h3 className="card-title">这一单买了什么</h3>
          <div className="items">
            {bill.items.map((item, i) => (
              <div className="item-row" key={`${item.name}-${i}`}>
                <span>{item.name}</span>
                <small>×{item.qty}</small>
                <strong>¥{formatFen(item.amount)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <button className="btn danger block" onClick={remove}>
        删掉这一笔
      </button>
    </div>
  );
}
