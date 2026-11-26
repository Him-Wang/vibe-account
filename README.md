# Vibe Account

> 说一句，账就记好了。

一个**语音优先**的本地记账网页应用：对着麦克风说「午饭 35，打车 18，买咖啡 22」，它会自动拆成三笔、分好类、记进当天的账里。所有数据只存在浏览器本地，随时可以导出或清空。

纯网页版，无需安装，打开就能用，也可以加到手机主屏当 app。

界面按「先说话、再打字」来排：首页中间是一个语音球，下面是输入条和快捷入口；底部四个标签是 **记录 / 账本 / 手账 / 我的**。

## 功能

- **语音记账**：浏览器 Web Speech API 实时转写，说完自动拆成多笔。
- **文字解析**：一句话里的多笔金额按标点拆分；配了 OpenAI 兼容接口就走大模型，没配就用本地规则。
- **手动记账**：金额、分类、日期、商家、备注，随时补一笔。
- **拍小票**：拍照或选图 → 识别商家与明细 → 核对后一次落账（Mock 演示流程）。
- **拍商品 / 贴纸**：抠图 + 四种动漫化风格，记账的同时生成贴纸。
- **手账**：Canvas 画布，纸色背景、emoji 与贴纸、文字、画笔、撤销，导出 1x / 2x / 3x PNG。
- **账本统计**：按月查看总额、分类占比条、按日分组。
- **隐私**：一键导出 JSON、导入合并、清空全部数据；无服务端。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## AI 解析（可选）

在「我的 → 设置」里填一个 OpenAI 兼容接口：

- 接口地址：如 `https://api.deepseek.com/v1`
- 模型：如 `deepseek-chat`
- API Key：只存在本机浏览器的 localStorage

不填也能用，本地规则能识别常见说法与金额。

## 语音

语音识别用浏览器自带的 Web Speech API（Chrome / Edge / Safari 支持较好），需要麦克风权限；不支持的浏览器会退化为纯文字输入。

## 数据

全部存在浏览器 `localStorage`，键前缀 `vibe-account:v1:`，共五个集合：`bills` / `categories` / `stickers` / `journalBooks` / `journals`。

## 目录

```
src/
  App.tsx           路由与外框
  views/            16 个页面
  components/       TabBar、通用 UI、图标
  lib/              storage / bills / categories / journals / stickers /
                    ai / speech / mock / data / router / ui / format
  styles.css        设计令牌与全部样式
```

## 说明

小票识别、抠图、动漫化目前是本地 Mock 流程，用于完整跑通交互；接入真实服务时替换 `src/lib/ai.ts` 里的实现即可。
