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
    a.download = `vibe-account-${new Date().toISOString().slice(0, 10)}.json`;
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
      title: "删除本机全部数据？",
      content: "账单、分类、贴纸和手账都会清空，且无法恢复。建议先导出备份。",
      danger: true,
      confirmText: "全部删除",
    });
    if (!ok) return;
    dataService.clearAll();
    toast("已清空，回到干净的状态");
    back();
  };

  return (
    <div className="page">
      <NavBar title="隐私与数据" sub="数据只在你的浏览器里" />

      <section className="card form">
        <h3 className="card-title">隐私政策（摘要）</h3>
        <ul className="policy">
          <li>只保存你主动记录的账单、分类、贴纸和手账内容。</li>
          <li>所有数据都存放在本机浏览器的 localStorage 中，不上传到任何服务器。</li>
          <li>如果你填写了模型 API Key，它也只保存在本机，仅用于你发起的解析请求。</li>
          <li>图片只在本机生成预览与导出，不会上传。</li>
          <li>你可以随时导出全部数据，或一键删除。</li>
        </ul>
      </section>

      <section className="card form">
        <h3 className="card-title">备份与恢复</h3>
        <button className="btn ghost block" onClick={exportData}>
          导出我的数据（JSON）
        </button>
        <button className="btn ghost block" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "导入中…" : "从备份导入（合并去重）"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => importData(e.target.files)}
        />
        <p className="muted small">导入按记录 ID 合并，不会覆盖你已有的账单。</p>
      </section>

      <section className="card form danger-zone">
        <h3 className="card-title">危险操作</h3>
        <button className="btn danger block" onClick={clearAll}>
          删除本机全部数据
        </button>
      </section>
    </div>
  );
}
