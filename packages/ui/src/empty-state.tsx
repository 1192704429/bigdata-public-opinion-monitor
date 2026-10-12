import type { JSX } from "react";

/**
 * 全局空状态图标。
 *
 * 形式：小图标 + 文字（飞书/钉钉/Notion 式克制风格）——淡蓝圆底 + 品牌蓝细线
 * 收件箱图标，隐喻"内容等待送达"。颜色取自设计 token 的 CSS 变量
 * （见 @aicp/design-tokens/tokens.css），随主题自动一致。
 * - EmptyStateIcon：常规空状态图标（48px），作为 antd Empty 的全局默认图（ConfigProvider empty.image）。
 * - EmptyStateIconMini：列表、表单等紧凑位置的迷你版（40px），替换 antd PRESENTED_IMAGE_SIMPLE。
 * 图标仅为装饰，语义由相邻的 Empty description 文本承担，因此对辅助技术隐藏。
 */

const INBOX_PATH_TOP = "M22 12h-6l-2 3h-4l-2-3H2";
const INBOX_PATH_BODY =
  "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z";

function InboxLines({ transform }: { transform: string }): JSX.Element {
  return (
    <g
      transform={transform}
      fill="none"
      stroke="var(--aicp-color-electric-cobalt)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={INBOX_PATH_TOP} />
      <path d={INBOX_PATH_BODY} />
    </g>
  );
}

export function EmptyStateIcon(): JSX.Element {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      // 固定渲染尺寸，避免被 antd 容器高度拉伸
      style={{ width: 48, height: 48 }}
    >
      {/* 淡蓝圆底 */}
      <circle cx="24" cy="24" r="24" fill="var(--aicp-color-bg-selected)" />
      {/* 收件箱线条图标（lucide 24×24 路径放大至圆底内居中） */}
      <InboxLines transform="translate(10.2 10.2) scale(1.15)" />
    </svg>
  );
}

export function EmptyStateIconMini(): JSX.Element {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ width: 40, height: 40 }}
    >
      <circle cx="20" cy="20" r="20" fill="var(--aicp-color-bg-selected)" />
      {/* translate 使放大后的图标几何中心与圆心 (20,20) 对齐 */}
      <InboxLines transform="translate(9.8 9.8) scale(0.85)" />
    </svg>
  );
}
