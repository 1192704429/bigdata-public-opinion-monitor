import { aicpAntdTheme } from "@aicp/design-tokens/antd";
import type { ThemeConfig } from "antd";

/**
 * 管理端 Ant Design 主题：在共享 token 上收紧表格密度与画布色，
 * 对标 Stripe / 飞书 / Ant Design Pro 的台账工艺，不改共享导出。
 */
export const adminAntdTheme: ThemeConfig = {
  ...aicpAntdTheme,
  token: {
    ...aicpAntdTheme.token,
    colorBgLayout: "#f7f7f7",
    colorText: "#171717",
    colorTextSecondary: "#5f5f5f",
    colorTextTertiary: "#737373",
    colorTextPlaceholder: "#b3b3b3",
    colorTextQuaternary: "#b3b3b3",
    colorBorderSecondary: "#ececec",
    colorFillSecondary: "#f8f8f8",
    colorFillTertiary: "#fafafa",
    colorBgTextHover: "#fafafa",
    colorLink: "#171717",
    colorLinkHover: "#171717",
    colorLinkActive: "#2563eb",
  },
  components: {
    ...aicpAntdTheme.components,
    Button: {
      ...aicpAntdTheme.components?.Button,
      defaultHoverColor: "#171717",
      defaultHoverBg: "#fafafa",
      defaultActiveColor: "#2563eb",
      textTextHoverColor: "#171717",
      textTextActiveColor: "#2563eb",
      textHoverBg: "#fafafa",
    },
    Table: {
      ...aicpAntdTheme.components?.Table,
      headerColor: "#737373",
      headerBg: "#fafafa",
      headerSplitColor: "#ececec",
      headerBorderRadius: 0,
      rowHoverBg: "#f8f8f8",
      cellPaddingBlock: 10,
      cellPaddingInline: 14,
      cellPaddingBlockSM: 10,
      cellPaddingInlineSM: 14,
      cellFontSize: 13,
      cellFontSizeSM: 13,
    },
    Pagination: {
      itemActiveBg: "#eff6ff",
      itemActiveColor: "#2563eb",
      itemActiveColorHover: "#2563eb",
    },
    Tree: {
      nodeHoverBg: "#fafafa",
      nodeHoverColor: "#171717",
      nodeSelectedColor: "#2563eb",
    },
  },
};
