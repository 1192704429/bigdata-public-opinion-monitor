// 台账表格行与对象卡片共用的操作组。
//
// 可见动作最多两个 type="text" 按钮（预览、编辑、进入管理等主动作），低频/危险动作进「更多」。
// 表格与卡片用同一套字号、高度和中性 hover，避免一边是链接按钮、一边是圆形图标按钮。
import { Button } from "antd";
import { type JSX, type MouseEvent } from "react";

import { CardOverflowMenu, type CardOverflowMenuItem } from "./card-overflow-menu";
import "./ledger-identity.css";

export type { CardOverflowMenuItem };

/** 行内可见动作：只承担文案，不放图标。 */
export interface LedgerOpsAction {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  danger?: boolean | undefined;
  ariaLabel?: string | undefined;
}

export interface LedgerOpsProps {
  actions: LedgerOpsAction[];
  /** 低频与危险动作；无有效项时不渲染触发器。 */
  more?:
    | {
        label: string;
        items: CardOverflowMenuItem[];
      }
    | undefined;
  /**
   * `row`：表格操作列与卡片标题栏，右对齐、28px。
   * `card`：卡片页脚，左对齐、24px。
   */
  density?: "row" | "card";
  /** 表格行可点击时默认拦截冒泡，避免点操作却打开详情。 */
  stopPropagation?: boolean | undefined;
  className?: string | undefined;
}

export function LedgerOps({
  actions,
  more,
  density = "row",
  stopPropagation = density === "row",
  className,
}: LedgerOpsProps): JSX.Element | null {
  const hasMore = Boolean(more?.items.some((item) => item.type !== "divider"));
  if (actions.length === 0 && !hasMore) return null;

  const handleGroupClick = stopPropagation
    ? (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
      }
    : undefined;

  return (
    <div
      className={`ledger-ops ledger-ops--${density}${className ? ` ${className}` : ""}`}
      onClick={handleGroupClick}
    >
      {actions.map((action) => (
        <Button
          key={action.key}
          type="text"
          size="small"
          className="ledger-ops__action"
          aria-label={action.ariaLabel ?? action.label}
          disabled={action.disabled === true}
          loading={action.loading === true}
          danger={action.danger === true}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}
      {hasMore && more ? (
        <CardOverflowMenu
          className="ledger-ops__more"
          size="small"
          label={more.label}
          items={more.items}
        />
      ) : null}
    </div>
  );
}
