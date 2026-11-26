import { useMemo, useState } from "react";
import { billService } from "../lib/bills";
import { currentMonth, dayLabel, formatFen, monthLabel, shiftMonth } from "../lib/format";
import { navigate } from "../lib/router";
import { Empty, NavBar } from "../components/ui";
import { PlusIcon } from "../components/icons";

const MAX_SEGMENTS = 5;

export default function Bills() {
  const [month, setMonth] = useState(currentMonth());
  const groups = useMemo(() => billService.grouped(month), [month]);
  const bills = useMemo(() => billService.list(month), [month]);
  const summary = useMemo(() => billService.monthSummary(month), [month]);
  const daysInMonth = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  }, [month]);

  const split = useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number }>();
    for (const bill of bills) {
      const key = bill.categoryId || bill.categoryName || "other";
      const row = map.get(key);
      if (row) row.total += bill.amount;
      else
        map.set(key, {
          name: bill.categoryName || "其他",
          color: bill.categoryColor || "#9b958f",
          total: bill.amount,
        });
    }
    const all = [...map.values()].sort((a, b) => b.total - a.total);
    if (all.length <= MAX_SEGMENTS) return all;
    const head = all.slice(0, MAX_SEGMENTS - 1);
    const rest = all.slice(MAX_SEGMENTS - 1).reduce((s, r) => s + r.total, 0);
    return [...head, { name: "其他分类", color: "#6d685f", total: rest }];
  }, [bills]);

  return (
    <div className="page">
      <NavBar
        title="账本"
        sub="每一笔都算数"
        showBack={false}
        right={
          <button className="icon-link" onClick={() => navigate("/bills/edit")}>
            ＋记一笔
          </button>
        }
      />

      <section className="month-switch">
        <button
          className="icon-btn"
          onClick={() => setMonth(shiftMonth(month, -1))}
          aria-label="上个月"
        >
          ‹
        </button>
        <div className="month-center">
          <strong>{monthLabel(month)}</strong>
          <small className="small muted">共 {summary.count} 笔</small>
        </div>
        <button
          className="icon-btn"
          onClick={() => setMonth(shiftMonth(month, 1))}
          aria-label="下个月"
          disabled={month >= currentMonth()}
        >
          ›
        </button>
      </section>

      <section className="total-block">
        <span className="label">这个月花掉</span>
        <div className="amount">
          <span>¥</span>
          {formatFen(summary.total)}
        </div>
        <span className="count">
          {summary.count} 笔 · 日均 ¥
          {formatFen(summary.count ? Math.round(summary.total / daysInMonth) : 0)}
        </span>
      </section>

      {split.length > 0 && (
        <section className="split">
          <div className="split-bar" aria-hidden="true">
            {split.map((row) => (
              <i
                key={row.name}
                style={{
                  width: `${summary.total ? (row.total / summary.total) * 100 : 0}%`,
                  background: row.color,
                }}
              />
            ))}
          </div>
          <div className="split-legend">
            {split.map((row) => (
              <span key={row.name}>
                <i style={{ background: row.color }} />
                {row.name} {summary.total ? Math.round((row.total / summary.total) * 100) : 0}%
              </span>
            ))}
          </div>
        </section>
      )}

      {groups.length === 0 ? (
        <Empty
          icon="🧾"
          text="这个月还没有记录"
          action={
            <button className="btn primary" onClick={() => navigate("/bills/edit")}>
              记第一笔
            </button>
          }
        />
      ) : (
        <div className="day-groups">
          {groups.map((group) => (
            <section key={group.date}>
              <div className="day-head">
                <span className="d">{dayLabel(group.date)}</span>
                <span>-¥{formatFen(group.total)}</span>
              </div>
              <div className="card list">
                {group.items.map((bill) => (
                  <button
                    key={bill._id}
                    className="bill-row"
                    onClick={() => navigate(`/bills/${bill._id}`)}
                  >
                    <span
                      className="bill-icon"
                      style={{ background: bill.categoryColor + "26", color: bill.categoryColor }}
                    >
                      {bill.categoryIcon}
                    </span>
                    <span className="bill-main">
                      <strong>{bill.note || bill.categoryName}</strong>
                      <small>
                        {bill.categoryName}
                        {bill.merchant ? ` · ${bill.merchant}` : ""}
                      </small>
                    </span>
                    <span className="bill-amount">-¥{formatFen(bill.amount)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => navigate("/bills/edit")} aria-label="记一笔">
        <PlusIcon size={22} />
      </button>
    </div>
  );
}
