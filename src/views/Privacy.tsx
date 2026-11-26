import { useRef, useState } from "react";
import { dataService } from "../lib/data";
import { confirmDialog, toast } from "../lib/ui";
import { back } from "../lib/router";
import { NavBar } from "../components/ui";

export default function Privacy() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    const json = dataService.exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suikouji-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    const copied = await dataService.copyText(json);
    toast(copied ? "已下载，并复制到剪贴板" : "已下载备份文件");
  };

  const importData = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const added = dataService.importAll(text);
      toast(added > 0 ? `导入了 ${added} 条数据` : "没有新的数据（可能已经导入过）");
    } catch (err) {
      toast(err instanceof Error ? err.message : "导入失败，检查一下文件");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearAll = async () => {
    const ok = await confirmDialog({
      title: "清空这台设备？",
      content: "流水、标签、贴纸、贴册和解析设置都会清空，没法找回。建议先导出备份。",
      danger: true,
      confirmText: "全部删除",
    });
    if (!ok) return;
    dataService.clearAll();
    toast("清空了，回到干干净净的样子");
    back();
  };

  return (
    <div className="page">
      <NavBar title="保险箱" sub="东西都锁在这台设备里" />

      <section className="card form">
        <h3 className="card-title">这份保险箱怎么管</h3>
        <ul className="policy">
          <li>只存你主动记下的流水、标签、贴纸和贴册。</li>
          <li>没有我们自己的服务器；数据都存在本机浏览器。只有你主动点「看账」且配置了解析接口时，汇总数字（分类、常去商家、最大一笔的名字）才会发给你指定的服务；不会发每笔明细或图片。</li>
          <li>语音默认用浏览器自带识别；填了转写接口后，录音会发给你指定的服务。</li>
          <li>如果你填写了模型 API Key，它也只保存在本机，仅用于你发起的解析请求。</li>
          <li>小票默认在本机用 OCR 读字；只有配置了视觉模型，小票图片才会发给你指定的服务核对。抠图在本机跑；只有配置了图片生成，商品图才会发给你指定的服务换画风。</li>
          <li>你可以随时导出全部数据，或一键删除。</li>
        </ul>
      </section>

      <section className="card form">
        <h3 className="card-title">备份与恢复</h3>
        <button className="btn ghost block" onClick={exportData}>
          导出我的数据（JSON）
        </button>
        <button className="btn ghost block" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "导入中…" : "从备份取回来（合并去重）"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => importData(e.target.files)}
        />
        <p className="muted small">按记录 ID 合并，不会盖掉你已有的账。</p>
      </section>

      <section className="card form danger-zone">
        <h3 className="card-title">想清空的话</h3>
        <button className="btn danger block" onClick={clearAll}>
          删除本机全部数据
        </button>
      </section>
    </div>
  );
}
