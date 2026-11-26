import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.himwang.suikouji",
  appName: "随口记",
  webDir: "dist",
  // 打包的是纯本地网页，不需要本地服务器；允许 file:// 下的相对资源。
  server: {
    androidScheme: "https",
    // iOS 上用 capacitor:// 方案加载本地文件，避免 file:// 下 fetch/WASM 受限。
    iosScheme: "capacitor",
  },
  android: {
    // 允许混合内容之外的本地资源加载；模型从 huggingface 下载需要网络权限。
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
