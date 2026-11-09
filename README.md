# Vibe Account

> 说一句话，自动拆成多笔支出。本地优先的 Windows 语音记账 MVP（Tauri 2 + React + TypeScript）。

![界面](tools/ui-verified.png)

## 功能

- **语音记账**：点「说一句」调用 Windows 内置语音识别（免费、离线，无需下载模型），转成文字后确认再解析；识别不可用时可直接打字。
- **一句话拆多笔**：调用你配置的 OpenAI 兼容大模型，把「早饭12，打车25，中午请同事吃饭180」拆成 4 条记录。
- **手动兜底**：手动添加、编辑、删除；金额精确到分，日期可选。
- **今日合计**：今天 / 全部两个视图，自动汇总。
- **本地持久化**：数据存 JSON，重启不丢；支持整体导出 / 导入（合并去重）。
- **毛玻璃 UI**：半透明、模糊、柔和渐变、光影层次；右上角开关可关闭（关闭后改为实色卡片，低配设备更流畅），选择会记住。
- **错误兜底**：未配置 Key、麦克风失败、语音识别失败、模型返回异常、保存失败都有中文提示。

## 安装与运行

**安装版**：双击 `Vibe Account_0.1.0_x64-setup.exe`，按向导安装（当前用户，不需要管理员）。开始菜单会出现「Vibe Account」。

**免安装版**：把 `Vibe Account-portable.exe` 和 `WebView2Loader.dll` 放在**同一个文件夹**里，双击 exe 运行（两个文件缺一不可）。首次启动会在 `%APPDATA%\com.vibeaccount.app\` 建数据目录；若该目录不可写，会自动把数据放在 exe 同级的 `data\` 文件夹。

系统要求：Windows 10/11 x64，WebView2 运行时（Win11 自带；Win10 若缺失，安装包会自动装）。

## 首次配置（必须）

1. 打开右上角 **设置**。
2. 填 **Base URL**、**模型**、**API Key**，保存。常见写法：

   | 服务 | Base URL | 模型示例 |
   | --- | --- | --- |
   | DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
   | 通义千问（兼容模式） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
   | 智谱 | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
   | 本地 Ollama | `http://127.0.0.1:11434/v1` | `qwen2.5:7b` |

   Base URL 只填到 `/v1` 即可，程序会自动补 `/chat/completions`。

3. 回到首页，输入或说出一段消费描述，点「解析并记账」。

## 使用

- 语音：点「说一句」→ 说完自动停止（最长 28 秒）→ 文字进入输入框 → 确认后解析。
- 键盘：`Ctrl + Enter` 直接解析。
- 编辑 / 删除：每条记录右侧的铅笔 / 垃圾桶图标。
- 导出：右上角「导出」下载 `vibe-account-YYYY-MM-DD.json`（只含账目，不含 Key）。
- 导入：右上角「导入」选择之前导出的 JSON；按 id 去重，不会重复记账。

## 数据与隐私

| 内容 | 位置 |
| --- | --- |
| 账目 `data.json` | `%APPDATA%\com.vibeaccount.app\` |
| 配置 `config.json` | 同上 |
| API Key `credentials.txt` | 同上（明文，仅当前 Windows 用户可读） |
| WebView2 缓存 | `%LOCALAPPDATA%\com.vibeaccount.app\` |

- 只有「解析并记账」会把文字发给你配置的模型服务；语音识别在本机完成。
- Key 不写日志、不导出、不随 JSON 泄露；但它是**明文文件**，请勿把数据目录发给别人。
- 没有账号、没有云同步、没有遥测。
- 便携版可用环境变量覆盖位置：`VIBE_DATA_DIR`、`VIBE_WEBVIEW_DIR`。

## 开发

```powershell
npm install
npm run tauri dev      # 开发模式（需要 Rust + MinGW/MSVC）
npm run tauri build    # 生产构建，产物在 src-tauri/target/release/
```

- 前端：`src/`（React 18 + Vite）
- 后端：`src-tauri/src/`
  - `storage.rs` 数据读写（tmp + rename 原子写）
  - `llm.rs` 模型调用与 JSON 校验（元 → 分、金额上限、类别白名单）
  - `speech.rs` Windows 语音识别
- 本机构建备注：MinGW-w64 + `x86_64-pc-windows-gnu`；若 cargo 报临时文件权限问题，把 `TEMP` 指到工作区目录。

## 已知限制

- 语音识别依赖 Windows 中文语音包与麦克风权限；虚拟机/远程桌面里可能没有麦克风。
- 解析质量取决于你选的模型；换模型或网络异常时会有提示，不会静默写错。
- 只做支出，不做收入/转账/退款/多币种（MVP 范围）。
- 未做代码签名，Windows 首次运行可能弹 SmartScreen，选择「更多信息 → 仍要运行」。

## 验收自检

| 要求 | 结果 |
| --- | --- |
| 能安装启动 | ✅ NSIS 安装包 + 免安装 exe |
| 一段话解析多笔并正确合计 | ✅ 4 笔 / ¥235.00（自动化验证） |
| 记录可编辑删除 | ✅ 18→20（合计 237）、删除后 217 |
| 重启后数据还在 | ✅ 重启后 3 条 / ¥217.00 |
| 毛玻璃可关闭 | ✅ 开关后 `backdrop-filter: none`，重启保持 |
| Key 不泄露 | ✅ 导出 JSON 不含 Key，日志不打印 |
