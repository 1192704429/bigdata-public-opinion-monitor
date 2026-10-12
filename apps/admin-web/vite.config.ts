import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // 绝对 base：深层路由刷新时 assets 由 Caddy 按 /admin/ 前缀剥离命中真实文件，
  // 相对 base（"./"）会在深层路径下把 assets 解析到错误目录并被 SPA 回退吞掉。
  base: "/admin/",
  // 根 tsconfig noEmit 阻止 tsc 在源码旁生成 .js 产物（历史遗留产物已清理），
  // 扩展名解析保持 vite 默认；若未来产物再现，先排查 noEmit 失效原因而非加解析顺序规避。
  plugins: [react()],
  server: {
    port: 4173,
    // 监听 0.0.0.0：本地 API 直连时前端可通过 localhost 或 127.0.0.1 访问，
    // Bearer token 不依赖浏览器凭证的跨主机携带规则。
    host: "0.0.0.0",
    // 本地业务 API 由 .env.development 的 VITE_API_BASE_URL 直连，最终由
    // packages/api-client/browser-endpoint module 解释（生产使用同源相对路径）。
  },
  build: {
    outDir: "dist",
  },
});
