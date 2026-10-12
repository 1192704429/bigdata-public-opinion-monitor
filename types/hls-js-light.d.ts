declare module "hls.js/light" {
  // 轻量构建与完整构建保持相同的基础播放器 API，只是移除了 DRM、字幕和多音轨等能力。
  export { default } from "hls.js";
}
