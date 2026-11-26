# Vibe Account · 拾光账本

> 说一句话，自动拆成多笔支出。也可以拍小票、拍商品、写手账 —— 一个纯网页的记账本。

这是 Vibe Account 的 **网页版**（不再有 exe / 桌面端）。数据全部保存在浏览器本机，没有后端、不用登录、不联网也能记账。

## 功能

**记账**

- 说一句 / 打一句「午饭 35，打车 18」，自动拆成多笔支出；有 API Key 时用大模型解析，没配 Key 时用本地中文规则解析
- 拍小票：识别成明细（Mock 演示），逐行改名称、单价、数量，合计自动算
- 拍商品 / 内置图库：抠图 + 动漫化风格，记账的同时生成一张贴纸
- 手动记账、编辑、详情、删除（软删除）
- 按月分组的账单列表，月份切换，本月合计 / 今日合计 / 累计支出
- 分类管理：商品分类与日期标签，可改名、删除、新增

**手账**

- 手账书坊：多本手账，自动封面配色
- Canvas 2D 编辑器：8 种纸色、20 个内置 emoji 贴纸、记账贴纸、上传图片、文字、画笔、拖动、双指缩放、撤销
- 高清导出 1x / 2x / 3x PNG，可预览、下载、分享
- 贴纸库：拍商品生成的贴纸集中管理

**其他**

- 设置：Base URL、模型、API Key、毛玻璃开关、AI Mock 三种状态（正常 / 失败 / 超时）
- 隐私与数据：导出 JSON（下载 + 复制）、导入合并去重、清空全部数据
- 深色极光 + 毛玻璃界面，珊瑚橘主题，移动优先

## 快速开始

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 dist/，任意静态服务器可托管
npm run preview
```

构建是纯静态站点，`base: './'`，可以直接丢到 GitHub Pages / 对象存储 / 任意静态目录。

## 配置 AI 解析（可选）

在「我的 → 设置」里填：

- Base URL：任意 OpenAI 兼容接口，默认 `https://api.deepseek.com/v1`
- 模型：默认 `deepseek-chat`
- API Key：只存在浏览器 localStorage，不会上传到别处

不填 Key 也能用：解析会走本地启发式规则（支持“今天/昨天/前天/M月D日”和“12块5”这类写法）。

## 语音

用浏览器自带的 Web Speech API（Chrome / Edge 支持最好），不打包 Whisper，不需要下载模型。不支持时「说一句」会提示，改用键盘输入即可。

## 数据

- 全部存在 `localStorage`，键前缀 `vibe-account:v1:`
- 集合：`bills` / `categories` / `stickers` / `journalBooks` / `journals`
- 换浏览器、清缓存会丢数据，记得用「隐私与数据 → 导出」备份

## 目录

```
src/
  App.tsx             # hash 路由 + 布局
  components/         # NavBar / Sheet / Stepper / TabBar 等
  views/              # 首页、账单、拍照、确认、手账、设置…
  lib/
    bills.ts categories.ts journals.ts stickers.ts data.ts   # localStorage 集合服务
    ai.ts             # 大模型解析 + 本地启发式解析
    speech.ts         # Web Speech API 封装
    router.ts ui.tsx format.ts settings.ts mock.ts flow.ts storage.ts
  styles.css
```

## 说明

- 拍照识别（OCR / 抠图 / 动漫化）目前是 Mock 演示数据，可在设置里切换成功 / 失败 / 超时三种状态，方便看异常流程
- 不收集任何数据，没有埋点，没有服务端
