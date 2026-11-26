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

优先级依次是：① 填了转写接口 → MediaRecorder 录音 + 服务端转写；② 浏览器自带 Web Speech（Chrome / Edge / Safari 支持较好，免下载）；③ 以上都不可用但能录音 → 点一下开始录、再点一下结束，用**本机 Whisper-tiny（q8）在设备上转写**，不上传也不花钱（首次下载模型约 60MB）；④ 都不能用才退化为文字输入。

录音需要麦克风权限，且必须运行在安全上下文（HTTPS 或本机 App）里；被拒绝或不在 HTTPS 下都会给出明确提示。

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

## 打包成手机 App（Android / iOS）

项目已用 [Capacitor 8](https://capacitorjs.com/) 打包成原生 App：`android/` 和 `ios/` 两个目录就是原生工程，网页内容放在各自的 `assets/public` / `App/public` 里。`capacitor.config.ts` 里 `appId` 是 `com.himwang.suikouji`，`appName` 是「随口记」。

**抠图模型已内置在安装包里，不需要联网下载**（0.3.0 起）：
- **Android**：原生 Java 插件 `CutoutPlugin` + ONNX Runtime，`assets/models/u2netp.onnx`（4.6MB，Apache-2.0），arm64-v8a。APK 约 32MB。
- **iOS**：原生 Swift 插件 `CutoutPlugin` + Core ML，MIT 协议的 BiRefNet Lite fp16（约 78MB），由 CI 在构建时下载并编译成 `.mlmodelc` 打进包里。IPA 约 86MB，**要求 iOS 17+**。
- App 里走原生引擎；网页版行为不变，仍走浏览器内 WASM/transformers.js。

现成安装包在 [Releases](https://github.com/Him-Wang/vibe-account/releases) 下载（v0.3.0）。想自己编译才需要对应工具链：Android 需要 Windows/macOS/Linux + Java 21 + Android SDK；iOS 必须在 **macOS + Xcode** 上编译（Windows 上无法产出 IPA）。也可直接触发 Actions 的 **Build Mobile Apps** 工作流，云端会自动构建并产出 APK / 未签名 IPA。下面按平台说明。

### 通用：先把网页同步进原生工程

每次改完前端都要先构建，再把 `dist/` 拷进原生工程：

```bash
npm install
npm run cap:sync        # = npm run build && cap sync
```

`cap sync` 会同时更新 Android 和 iOS 两个工程。只想重灌网页、不重新构建时可单独跑 `npx cap copy`。

### Android：产出 APK

1. 安装 [Android Studio](https://developer.android.com/studio)（自带 JDK 21 和 Android SDK）。
2. 设置环境变量 `ANDROID_HOME`（或 `ANDROID_SDK_ROOT`）指向 SDK 目录，例如 Windows 上 `C:\Users\<你>\AppData\Local\Android\Sdk`。
3. 打开工程：`npx cap open android`（会用 Android Studio 打开 `android/`）。
4. 等 Gradle 同步完成，菜单 **Build → Build Bundle(s) / APK(s) → Build APK(s)**。
   - 调试包：`android/app/build/outputs/apk/debug/app-debug.apk`
   - 正式包：先 **Build → Generate Signed Bundle / APK**，建一个 keystore，再用它签出 release APK。
5. 手机开启「未知来源安装」，把 APK 传进去点安装即可。

命令行出包（可选）：

```bash
cd android
./gradlew assembleDebug      # macOS / Linux
gradlew.bat assembleDebug    # Windows
```

**已配置权限**：`INTERNET`（拉模型）、`RECORD_AUDIO` / `MODIFY_AUDIO_SETTINGS`（语音）、`READ_EXTERNAL_STORAGE`（旧设备读图）。麦克风属于危险权限，App 首次录音时会弹系统授权框——这是正常行为，允许即可。

### iOS：在 macOS 上编译 + 自签名安装

iOS 无法在 Windows 上打包，以下步骤在一台 **Mac** 上完成。

#### 前置条件

- macOS + [Xcode](https://apps.apple.com/cn/app/xcode/id497799835)（App Store 安装，含 iOS SDK）+ Xcode Command Line Tools（`xcode-select --install`）。
- 一个**免费的 Apple ID** 即可做自签名（不需要付费开发者账号）。

#### 步骤

1. 在 Mac 上 clone 仓库并安装依赖：

   ```bash
   git clone https://github.com/Him-Wang/vibe-account.git
   cd vibe-account
   npm install
   npm run cap:sync
   npx cap open ios        # 用 Xcode 打开 ios/App/App.xcworkspace
   ```

   注意：打开的是 `ios/App/App.xcworkspace`（Swift Package Manager 依赖），不是 `.xcodeproj`。

2. 在 Xcode 里选中左侧 **App** target → **Signing & Capabilities**：
   - 勾选 **Automatically manage signing**。
   - **Team** 选 **Add a Team…** → 用你的 Apple ID 登录（免费账号即可）。
   - **Bundle Identifier** 保持 `com.himwang.suikouji`；如果报「Identifier 已被占用」，改成你自己的唯一值，例如 `com.你的名字.suikouji`（同时改 `capacitor.config.ts` 的 `appId` 再 `cap sync`）。
   - 在 **Info.plist** 里确认 `NSMicrophoneUsageDescription`（麦克风用途说明）存在——仓库已配好。

3. 选择一台**真机**（USB 连上 iPhone，在 Xcode 顶部设备列表选它）。模拟器也能跑，但没有麦克风真实输入。

4. 处理签名信任（免费账号的关键一步）：
   - 首次点 **▶ Run** 编译安装时，Xcode 可能报 `Signing for "App" requires a development team` 或 `Failed to create provisioning profile`——确认第 2 步 Team 已选。
   - 免费账号签名的 App 安装到真机后，首次打开会提示「不受信任的企业级开发者」。到 iPhone **设置 → 通用 → VPN 与设备管理（或「描述文件与设备管理」）→ 选你的 Apple ID → 信任**。
   - 注意：**免费签名有效期只有 7 天**，到期后 App 会打不开，需要重新连 Mac 用 Xcode 跑一次（或重签）。付费 Apple Developer 账号（¥688/年）签发的 App 可上架且 1 年有效。

5. 点 **▶ Run**（`Cmd+R`）编译并安装到手机。

#### 导出 IPA（分发用）

- 在 Xcode 菜单 **Product → Archive**，完成后在 Organizer 里 **Distribute App**。
- 免费账号只能导出 **Development** 包给注册设备；要 Ad Hoc / App Store 分发需付费账号。
- 也可以命令行导出：

  ```bash
  cd ios/App
  xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
    -archivePath build/App.xcarchive archive
  xcodebuild -exportArchive -archivePath build/App.xcarchive \
    -exportPath build/Export -exportOptionsPlist exportOptions.plist
  ```

  导出前先把 `ios/App/exportOptions.plist` 里的 `teamID` 换成你自己的 Team ID（在 Xcode 的 Signing & Capabilities 里能看到）。

#### iOS 上的注意点

- 语音和本地 Whisper 需要麦克风权限，首次使用会弹系统授权；拒绝后到 **设置 → 隐私与安全性 → 麦克风** 里重新允许。
- 抠图模型已内置，离线可用。首次**语音**仍会下载本地 Whisper 模型（约 60MB）并缓存在 App 内，需要联网一次。
- `capacitor.config.ts` 用 `iosScheme: "capacitor"`，`WASM`/`fetch` 在 App 内可用；不要改成 `file://`，否则模型下载会失败。

## 说明

- **小票**：真实可用的本地 OCR（`tesseract.js`），识别文字后在本机解析商家、日期、明细与合计；图片不会上传。配置视觉模型后才会把图片发给你指定的接口做核对。
- **拍物**：抠图用本地 BiRefNet-lite（`@huggingface/transformers`，浏览器内跑，首次下载模型）；没有配置图片生成时保留抠图，配置了才会生成画风。内置样张会生成一张本地 SVG 贴纸，不再显示 📦。
- **语音**：默认用浏览器语音；配置转写接口后改用录音上传。
- **存储**：浏览器配额满时写入会失败；如果图片很多，建议先导出备份，再清理贴册。Worker 的额度按部署者自己的账号计算，公开分享前请确认口令没有泄露。
