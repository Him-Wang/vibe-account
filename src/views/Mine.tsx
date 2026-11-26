import { billService } from "../lib/bills";
import { journalService } from "../lib/journals";
import { stickerService } from "../lib/stickers";
import { formatFen } from "../lib/format";
import { GoRow, NavBar } from "../components/ui";

export default function Mine() {
  const total = billService.grandTotal();
  const count = billService.all().length;
  const books = journalService.listBooks().length;
  const stickers = stickerService.list().length;

  return (
    <div className="page">
      <NavBar title="我的" showBack={false} />

      <section className="profile card">
        <div className="avatar lg">拾</div>
        <div>
          <h2>拾光用户</h2>
          <p className="muted small">一个人，一本账，一叠手账</p>
        </div>
      </section>

      <section className="stat-strip">
        <div>
          <strong>{count}</strong>
          <small>笔账单</small>
        </div>
        <div>
          <strong>¥{formatFen(total)}</strong>
          <small>累计支出</small>
        </div>
        <div>
          <strong>{books}</strong>
          <small>本手账</small>
        </div>
        <div>
          <strong>{stickers}</strong>
          <small>张贴纸</small>
        </div>
      </section>

      <section className="card list">
        <GoRow icon="🏷️" title="分类管理" desc="商品分类与日期标签" to="/categories" />
        <GoRow icon="🃏" title="贴纸库" desc="拍商品自动生成" to="/mine/stickers" />
        <GoRow icon="⚙️" title="设置" desc="模型、外观与 AI 演示" to="/mine/settings" />
        <GoRow icon="🔒" title="隐私与数据" desc="导出、导入、清空" to="/mine/privacy" />
      </section>

      <p className="muted small center footer-note">
        纯网页版 · 数据保存在本机浏览器
        <br />
        Vibe Account × 拾光账本
      </p>
    </div>
  );
}
