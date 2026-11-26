import { useMemo, useState } from "react";
import { billService } from "../lib/bills";
import { currentMonth, dayLabel, formatFen, monthLabel, shiftMonth } from "../lib/format";
import { navigate } from "../lib/router";
import { Empty, NavBar } from "../components/ui";

export default function Bills() {
  const [month, setMonth] = useState(currentMonth());
  const groups = useMemo(() => billService.grouped(month), [month]);
  const summary = useMemo(() => billService.monthSummary(month), [month]);

  return (
    <div className="page">
      <NavBar
        title="账单"
        sub="按日分组，点击查看详情"
        showBack={false}
        right={
          <button className="icon-link" onClick={() => navigate("/bills/edit")}>
            ＋记一笔
          </button>
        }
      />

      <section className="month-bar card">
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="上个月">
          ‹
        </button>
        <div className="month-center">
          <strong>{monthLabel(month)}</strong>
          <small>
            支出 ¥{formatFen(summary.total)} · {summary.count} 笔
          </small>
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

      {groups.length === 0 ? (
        <Empty
          icon="📭"
          text="这个月还没有账单"
          action={
            <button className="btn primary" onClick={() => navigate("/bills/edit")}>
              记第一笔
            </button>
          }
        />
      ) : (
        <div className="day-groups">
          {groups.map((group) => (
            <section key={group.date} className="day-group">
              <div className="day-head">
                <span>{dayLabel(group.date)}</span>
                <span className="muted small">-¥{formatFen(group.total)}</span>
              </div>
              <div className="card list">
                {group.items.map((bill) => (
                  <button key={bill._id} className="bill-row" onClick={() => navigate(`/bills/${bill._id}`)}>
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
        ＋
      </button>
    </div>
  );
}
