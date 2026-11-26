import { billService } from "../lib/bills";
import { journalService } from "../lib/journals";
import { stickerService } from "../lib/stickers";
import { formatFen } from "../lib/format";
import { GoRow, NavBar } from "../components/ui";
import { GearIcon, ShieldIcon, StickerIcon, TagIcon } from "../components/icons";

export default function Mine() {
  const total = billService.grandTotal();
  const count = billService.all().length;
  const books = journalService.listBooks().length;
  const stickers = stickerService.list().length;
  const voiceCount = billService.all().filter((b) => b.source === "voice").length;

  return (
    <div className="page">
      <NavBar title="我的" sub="本地账户" showBack={false} />

      <section className="profile card">
        <div className="avatar lg">V</div>
        <div>
          <h2>Vibe Account</h2>
          <p className="muted small">
            {voiceCount > 0 ? `已经用声音记了 ${voiceCount} 笔` : "说一句话，账就记好了"}
          </p>
        </div>
      </section>

      <section className="stat-strip">
        <div>
          <strong>{count}</strong>
          <small>笔记录</small>
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
        <GoRow icon={<TagIcon />} title="分类管理" desc="商品分类与日期标签" to="/categories" />
        <GoRow icon={<StickerIcon />} title="贴纸库" desc="拍商品自动生成" to="/mine/stickers" />
        <GoRow icon={<GearIcon />} title="设置" desc="模型、外观与 AI 演示" to="/mine/settings" />
        <GoRow icon={<ShieldIcon />} title="隐私与数据" desc="导出、导入、清空" to="/mine/privacy" />
      </section>

      <p className="muted small center footer-note">
        纯网页版 · 数据保存在本机浏览器
        <br />
        随时可以导出，或一键清空
      </p>
    </div>
  );
}
