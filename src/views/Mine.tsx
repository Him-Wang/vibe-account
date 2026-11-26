import { billService } from "../lib/bills";
import { journalService } from "../lib/journals";
import { stickerService } from "../lib/stickers";
import { formatFen } from "../lib/format";
import { GoRow, NavBar } from "../components/ui";
import { LogoMark } from "../components/Logo";
import { SparkIcon, GearIcon, ShieldIcon, StickerIcon, TagIcon } from "../components/icons";

export default function Mine() {
  const total = billService.grandTotal();
  const count = billService.all().length;
  const books = journalService.listBooks().length;
  const stickers = stickerService.list().length;
  const voiceCount = billService.all().filter((b) => b.source === "voice").length;

  return (
    <div className="page">
      <NavBar title="本机" sub="只属于这台设备" showBack={false} />

      <section className="profile card">
        <div className="avatar">
          <LogoMark size={52} />
        </div>
        <div>
          <h2>随口记</h2>
          <p className="muted small">
            {voiceCount > 0 ? `已经用声音记了 ${voiceCount} 笔` : "说一句话，账就记好了"}
          </p>
        </div>
      </section>

      <section className="stat-strip">
        <div>
          <strong>{count}</strong>
          <small>笔</small>
        </div>
        <div>
          <strong>¥{formatFen(total)}</strong>
          <small>累计支出</small>
        </div>
        <div>
          <strong>{books}</strong>
          <small>本贴册</small>
        </div>
        <div>
          <strong>{stickers}</strong>
          <small>张贴纸</small>
        </div>
      </section>

      <section className="card list">
        <GoRow icon={<SparkIcon />} title="看账" desc="AI 分析流水，给省钱建议" to="/insights" />
        <GoRow icon={<TagIcon />} title="标签册" desc="记账标签和日期" to="/categories" />
        <GoRow icon={<StickerIcon />} title="图鉴" desc="拍物时自动收进来" to="/mine/stickers" />
        <GoRow icon={<GearIcon />} title="偏好" desc="解析、视觉和语音" to="/mine/settings" />
        <GoRow icon={<ShieldIcon />} title="保险箱" desc="导出、导入、清空" to="/mine/privacy" />
      </section>

      <p className="muted small center footer-note">
        纯网页版 · 东西都在本机浏览器里
        <br />
        随时可以导出，或一键清空
      </p>
    </div>
  );
}
