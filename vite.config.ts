import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

// Vite/sirv refuses dotfiles, but the selected reference screen lives at /.html.
const serveReference: Plugin = {
  name: "serve-reference-screen",
  configureServer(server) {
    server.middlewares.use((req: any, res: any, next: () => void) => {
      const url = (req.url || "").split("?")[0];
      if (url !== "/.html") return next();
      fs.promises
        .readFile(path.join(root, ".html"), "utf8")
        .then((html) => server.transformIndexHtml("/.html", html))
        .then((html) => {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        })
        .catch(next);
    });
  },
};

export default defineConfig({
  plugins: [react(), serveReference],
  base: "./",
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "chrome100",
    minify: "esbuild",
  },
});
