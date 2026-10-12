// 卡片/列表行内的「更多操作」菜单。
//
// 用途：把卡片/列表行中 3+ 个低频/维护性质的动作收进统一的"更多"入口，
// 解决行内操作按钮拥挤、宽度被占用、视觉权重过高的问题。
// 高频主动作（预览、用此材料生成、试运行等）仍直接可见，本组件只收纳次要操作。
//
// 设计要点：
// - 触发器：矩形 text 按钮（控件 5px 圆角）+ MoreHorizontal 图标，常驻显示以保证可发现性
//   （不再使用 hover 才出现的隐藏策略，避免触屏用户无法触达）。
// - 菜单项支持图标 + 标签 + danger + disabled，与 antd Menu API 形态一致。
// - 触发器 aria-label 描述菜单整体而非具体项目（菜单项本身有可访问标签）。
// - 危险操作走 danger，键盘导航、Esc 关闭、点击外部关闭由 antd Dropdown 内置。
// - shape 可传 "default" 保持矩形（运营工作台会话行与归档按钮同规格）；
//   该调用方按产品决定使用 hover 浮现 + 竖排图标（触屏 hover:none 常驻），
//   见 DESIGN.md「Card Overflow Menu」节的豁免说明。
//
// 不适用的场景：
// - 单个或两个操作（直接用 Button 即可，菜单反而多余）。
// - 主动作（必须始终可见、不能被折叠）。
// - 含复杂表单/弹窗触发的子流程（应走 Drawer/Modal 路径）。
import { Button, Dropdown, type DropdownProps, type MenuProps } from "antd";
import { MoreHorizontal } from "lucide-react";
import { type JSX, type ReactNode } from "react";

/** 菜单项：标准项（可点击）或分隔线。 */
export type CardOverflowMenuItem =
  | {
      type?: "item";
      key: string;
      label: string;
      icon?: ReactNode;
      danger?: boolean;
      disabled?: boolean;
      onClick: () => void;
    }
  | { type: "divider"; key: string };

export interface CardOverflowMenuProps {
  items: CardOverflowMenuItem[];
  /**
   * 触发按钮的 aria-label，描述该菜单所收纳的操作类别。
   * 例：`<CardOverflowMenu label="更多材料操作" ... />`
   */
  label: string;
  /**
   * 触发按钮尺寸。
   * - `small`（默认）：卡片页脚与操作组「更多」，由 CSS 收到 24/28px。
   * - `middle`：仅非操作组场景需要更大命中区时使用。
   */
  size?: "small" | "middle";
  /** 触发按钮形状：默认矩形（与系统控件 5px 圆角一致）；
   *  行内与其他按钮并排时也使用 `"default"`。 */
  shape?: "circle" | "default";
  /** 自定义触发图标，默认 `MoreHorizontal`。传入时需自行附带 `aria-hidden`。 */
  trigger?: ReactNode;
  /** 菜单弹出位置，默认右下。 */
  placement?: DropdownProps["placement"];
  /** 触发按钮的额外 className，用于在调用方上下文中调整样式。 */
  className?: string;
}

export function CardOverflowMenu({
  items,
  label,
  size = "small",
  shape = "default",
  trigger,
  placement = "bottomRight",
  className,
}: CardOverflowMenuProps): JSX.Element {
  // 显式构造菜单项，避免与 antd MenuProps 的 exactOptionalPropertyTypes 严格模式冲突
  // （直接展开 item 会把 `danger?: boolean` 推断为 `boolean | undefined`，与 antd 期望的 `boolean` 不兼容）。
  const menuItems: NonNullable<MenuProps["items"]> = items.map((item) => {
    if (item.type === "divider") {
      return { type: "divider" as const, key: item.key };
    }
    const entry: NonNullable<MenuProps["items"]>[number] = {
      key: item.key,
      label: item.label,
      icon: item.icon,
      onClick: item.onClick,
    };
    if (item.danger !== undefined) entry.danger = item.danger;
    if (item.disabled !== undefined) entry.disabled = item.disabled;
    return entry;
  });

  const iconSize = size === "small" ? 14 : 16;

  // 条件传入 className/shape，避免 exactOptionalPropertyTypes 严格模式下 string|undefined 不被接受
  const buttonProps: Record<string, unknown> = {
    type: "text",
    size,
    shape,
    icon: trigger ?? <MoreHorizontal size={iconSize} aria-hidden="true" focusable="false" />,
    "aria-label": label,
  };
  const classes = ["card-overflow-menu", className].filter(Boolean).join(" ");
  if (classes.length > 0) buttonProps.className = classes;

  return (
    <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement={placement}>
      <Button {...buttonProps} />
    </Dropdown>
  );
}
