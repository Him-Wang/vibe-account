# 随口记 · 说一句，账就记好了

> 语音优先、纯网页、只存本机的记账本。

对着麦克风说「午饭 35，打车 18，买咖啡 22」，随口记会拆成三笔、分好类、记进今天。也可以扫小票（浏览器里跑 OCR）、把喜欢的东西抠成贴纸，贴进自己的贴册。

数据只存在浏览器 `localStorage`，没有服务端，随时导出或清空。默认不接任何外部 AI，本地记账、扫票 OCR、抠图、语音都能直接用；想用 AI 再自己填接口。

## 四个入口

- **说一句**：用说的记一笔；也能打字，或扫小票、拍物、手记。
- **流水**：按月看花了多少、分到哪些标签、按天排的每一笔。
- **贴册**：把小票、贴纸和碎碎念贴进纸里，导出成图片。
- **本机**：标签册、图鉴、偏好、保险箱（备份 / 导入 / 清空）。

其余页面沿用同一套叫法：**核对小票**、**收下这件**、**图鉴**、**偏好**、**保险箱**、**这笔账**。

## 设计

「糖纸贴贴」：奶油纸底 + 点阵、墨蓝描边、硬投影，薰衣草 / 薄荷 / 黄油 / 天空四块柔色；圆角贴纸块与窄体数字并置。

- 设计变量在 `tokens.css`，组件覆写在 `src/candy.css`。
- 响应式：手机是单列 + 底部胶囊导航；≥ 1024px 切换成左侧竖向导航和首页双栏（左边记账、右边最近记录），表单页收窄为阅读栏。
- 路由用 hash（`#/bills`），构建产物可放在任意子路径。
- 首页原型：`.html`（本地开发时访问 `http://localhost:5173/.html`；这是设计参照页，不参与构建）。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## 部署到 GitHub Pages

仓库已带 `.github/workflows/deploy.yml`，线上地址：

**https://him-wang.github.io/vibe-account/**

1. 推到 `main` 会自动跑 workflow。
2. 仓库 **Settings → Pages → Build and deployment → Source** 已设为 **GitHub Actions**。
3. 也可以在 Actions 页手动 `Run workflow`。

`vite.config.ts` 的 `base: "./"` 让静态资源按相对路径加载，仓库名变化也不用改配置。注意：首次扫票 / 抠图会从 CDN / Hugging Face 下载识别模型，需要联网；静态站本身不需要后端。

## AI 与识别（都可选）

默认不接任何外部 AI；下面这些接口都是可选的，填了才会启用：

- **语音与文字解析**：把一句话拆成多笔；不填就走本地规则，填了才会把这句话发给该接口。
- **小票视觉核对**：不启用时，扫票只用浏览器里的 Tesseract 本地 OCR；启用后先在本机读一遍字，再把压缩后的图片和文字交给视觉模型核对。图片只在这个开关打开时才离开浏览器。
- **语音输入**：不填 Key 也能用——手机浏览器里录一段音，用本地 Whisper-tiny（q8）在设备上转写，不上传也不花钱（首次下载模型约 60MB）；填一个转写接口（如 `whisper-1`）后则优先走云端转写；桌面 Chrome / Edge 也可用浏览器自带语音。
- **图片生成**：不启用时，拍物只做本地抠图并保存；配置一个支持 `POST /images/edits` 的接口（如 OpenAI `gpt-image-1`）后，点「可爱 / 漫画 / 油画 / 素描」才会真的生成画风，并把结果作为贴纸的 `animeFileId` 保存。商品图只在这个开关打开时才发出去。
- **看账**：配置「语音与文字解析」后，首页会出现 AI 条；点进去会把当月汇总（分类、常去商家、最大一笔的名字）发给该接口，换回一句总结、几条观察和 3 条省钱建议。没配置时仍能在本机看基础结论。

Key 都只存在本机 `localStorage`。第一次跑本地 OCR 会从 CDN 下载中文模型（约 15MB）和 worker，之后浏览器会缓存；小票图片不经过这个下载。拍物抠图首次会下载 BiRefNet-lite（WebGPU 约 94MB / WASM 约 183MB，之后浏览器缓存），在本机 WebGPU/WASM 里跑，不上传原图；进度按实际下载字节显示，卡住会提示重试而不是停在 0%。

> 直接调第三方视觉 / 转写接口需要对方允许浏览器跨域（CORS）。遇到 CORS 报错，可以自己搭一个 serverless 代理：浏览器只把请求发给你自己的函数，由函数带上 Key 转发，同时把 Key 留在服务端。纯本机使用不需要代理。

仓库里带了两种可部署的 Cloudflare Worker，步骤见 [`serverless/README.md`](serverless/README.md)：

- `serverless/worker.mjs`：转发到你自己的上游 Key，浏览器只拿 `PROXY_TOKEN`。
- `serverless/worker-ai.mjs`：绑定 Cloudflare Workers AI，自带文本和视觉模型，不需要上游 Key。适合部署到自己的 Cloudflare 账号，再把地址和 `PROXY_TOKEN` 填进「偏好 → 自定义」。

Worker 的额度走部署者自己的 Cloudflare 账号，项目不会内置任何人的公开 Key。按 [`serverless/README.md`](serverless/README.md) 部署后，在「偏好」里填自己的接口地址和口令即可。

## 语音

默认用浏览器自带的 Web Speech API（Chrome / Edge / Safari 支持较好），需要麦克风权限；不支持的浏览器退化为文字输入。在「偏好 → 语音输入」填了转写接口后，会改用 MediaRecorder 录音 + 服务端转写，不再依赖 Web Speech。

## 数据

键前缀 `vibe-account:v1:`，五个集合：`bills` / `categories` / `stickers` / `journalBooks` / `journals`；另有 `settings` 保存接口地址、模型与 Key。全部在本机浏览器，导出 JSON 即可备份（解析设置不在导出范围内，清空数据时会一起抹掉）。

## 目录

```
tokens.css          设计变量（颜色、字号、圆角、投影、间距）
serverless/         可选的 Cloudflare Worker 代理（视觉 / 转写）
src/
  candy.css         糖纸贴贴组件层
  App.tsx           路由与外框
  views/            17 个页面
  components/       导航、页签、通用 UI、图标、Logo
  lib/              storage / bills / categories / journals / stickers /
                    ai / ocr / vision / asr / imagegen / cutout / insights /
                    stickerArt / speech / mock / router / format
.html               首页设计参照（仅本地）
drafts/-b.html      另一版方向草稿（仅本地）
```

## 说明

- **小票**：真实可用的本地 OCR（`tesseract.js`），识别文字后在本机解析商家、日期、明细与合计；图片不会上传。配置视觉模型后才会把图片发给你指定的接口做核对。
- **拍物**：抠图用本地 BiRefNet-lite（`@huggingface/transformers`，浏览器内跑，首次下载模型）；没有配置图片生成时保留抠图，配置了才会生成画风。内置样张会生成一张本地 SVG 贴纸，不再显示 📦。
- **语音**：默认用浏览器语音；配置转写接口后改用录音上传。
- **存储**：浏览器配额满时写入会失败；如果图片很多，建议先导出备份，再清理贴册。Worker 的额度按部署者自己的账号计算，公开分享前请确认口令没有泄露。
