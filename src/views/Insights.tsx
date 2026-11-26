import { useEffect, useMemo, useRef, useState } from "react";
import { currentMonth, formatDate, formatFen, monthLabel } from "../lib/format";
import { analyzeWithAI, buildInsight, localFindings, type AiInsight } from "../lib/insights";
import { navigate } from "../lib/router";
import { hasApiKey, useSettings } from "../lib/settings";
import { Empty, NavBar } from "../components/ui";
import { SparkIcon, TagIcon } from "../components/icons";

export default function Insights() {
  const settings = useSettings();
  const month = currentMonth();
  const stats = useMemo(() => buildInsight(month), [month]);
  const local = useMemo(() => localFindings(stats), [stats]);
  const [ai, setAi] = useState<AiInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  const configured = hasApiKey();

  const run = async () => {
    if (loading || stats.count === 0) return;
    setLoading(true);
    setError("");
    try {
      setAi(await analyzeWithAI(stats));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 暂时没回话");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (started.current || !configured || stats.count === 0) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, stats.count]);

  return (
    <div className="page">
      <NavBar title="看账" sub="AI 帮你找省钱的缝隙" />

      {stats.count === 0 ? (
        <Empty
          icon={<TagIcon size={24} />}
          text="这个月还没有账，记两笔再来看"
          action={
            <button className="btn primary" onClick={() => navigate("/bills/edit")}>
              记一笔
            </button>
          }
        />
      ) : (
        <>
          <section className="insight-hero">
            <span className="insight-month">{monthLabel(stats.month)}</span>
            <strong className="insight-total">¥{formatFen(stats.total)}</strong>
            <div className="insight-facts">
              <span>
                <b>{stats.count}</b> 笔
              </span>
              <span>
                日均 <b>¥{formatFen(Math.round(stats.total / stats.days))}</b>
              </span>
              {stats.trend !== null && (
                <span>
                  比上月 <b>{stats.trend > 0 ? "+" : ""}{Math.round(stats.trend * 100)}%</b>
                </span>
              )}
            </div>
          </section>

          <section className={loading ? "ai-card is-loading" : "ai-card"}>
            <div className="ai-card-head">
              <span className="ai-card-icon">
                <SparkIcon size={18} />
              </span>
              <div className="ai-card-title">
                <strong>AI 看账</strong>
                <small>{configured ? settings.model : "还没有接上"}</small>
              </div>
              {configured && !loading && (
                <button className="ai-refresh" onClick={run} aria-label="重新分析">
                  重新看
                </button>
              )}
            </div>

            {!configured && (
              <div className="ai-empty">
                <p>接上解析接口后，AI 会读这份月账，指出花得偏多的地方，再给三条能马上试的省钱动作。</p>
                <button className="btn primary" onClick={() => navigate("/mine/settings")}>
                  去接上
                </button>
                <small>只在点「看账」时发送汇总数字，不发账单图片。</small>
              </div>
            )}

            {loading && (
              <div className="ai-loading">
                <i />
                <span>正在翻这个月的账…</span>
              </div>
            )}

            {error && !loading && (
              <div className="ai-error">
                <p>{error}</p>
                <button className="btn small" onClick={run}>
                  再试一次
                </button>
              </div>
            )}

            {ai && !loading && (
              <div className="ai-result">
                <p className="ai-headline">{ai.headline}</p>
                <ul className="ai-findings">
                  {ai.findings.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {ai && ai.tips.length > 0 && (
            <section className="tips-block">
              <div className="section-head">
                <h2>可以试试</h2>
                <small>不用一次全做</small>
              </div>
              <ol className="tip-list">
                {ai.tips.map((tip, i) => (
                  <li key={tip.title} className="tip-card">
                    <span className="tip-no">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{tip.title}</strong>
                      <p>{tip.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="local-block">
            <div className="section-head">
              <h2>本月的账</h2>
              <small>不联网也能看</small>
            </div>
            <ul className="local-list">
              {local.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="insight-mini">
              {stats.categories.slice(0, 3).map((cat) => (
                <span key={cat.name}>
                  {cat.name}
                  <b>{Math.round(cat.share * 100)}%</b>
                </span>
              ))}
              {stats.biggest && (
                <span className="mini-wide">
                  最大一笔
                  <b>{formatDate(stats.biggest.date)}</b>
                </span>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
