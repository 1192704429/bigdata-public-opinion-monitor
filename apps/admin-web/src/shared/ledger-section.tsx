import { type ReactNode } from "react";

import "./ledger-section.css";
import "./ledger-identity.css";

export interface LedgerToolbarProps {
  /** 左侧筛选组件（如 Segmented 状态筛选、分类下拉、日期选择等） */
  filters?: ReactNode;
  /** 搜索输入框或主搜索组件 */
  search?: ReactNode;
  /** 右侧操作（如批量操作触发器、新建按钮、视图切换等） */
  actions?: ReactNode;
  /** 右侧附加项（如排序下拉、刷新等） */
  extra?: ReactNode;
  className?: string;
}

export function LedgerToolbar({
  filters,
  search,
  actions,
  extra,
  className,
}: LedgerToolbarProps): ReactNode {
  return (
    <div className={`ledger-section__toolbar${className ? ` ${className}` : ""}`}>
      <div className="ledger-section__toolbar-left">
        {filters}
        {search}
      </div>
      {actions || extra ? (
        <div className="ledger-section__toolbar-right">
          {actions}
          {extra}
        </div>
      ) : null}
    </div>
  );
}

export interface LedgerSectionProps {
  /** 顶部工具栏（推荐使用 `<LedgerSection.Toolbar>`） */
  toolbar?: ReactNode;
  /** 内容主体（Table、Card Grid 或 List） */
  children: ReactNode;
  /** 底部操作栏/分页器 */
  footer?: ReactNode;
  /**
   * 变体模式：
   * - "default"：整体白面卡片（适用于 Table 数据表格）
   * - "flat"：工具栏白面、内容区与分页平铺（适用于网格卡片矩阵，避免外层卡片嵌套）
   */
  variant?: "default" | "flat";
  className?: string;
  "aria-label"?: string;
}

/**
 * 标准资产台账母版容器（LedgerSection）：
 * 统一整合搜索/筛选工具条、数据内容区与底部分页栏。
 */
export function LedgerSection({
  toolbar,
  children,
  footer,
  variant = "default",
  className,
  "aria-label": ariaLabel,
}: LedgerSectionProps): ReactNode {
  const classNames = ["ledger-section", variant === "flat" ? "ledger-section--flat" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classNames} aria-label={ariaLabel}>
      {toolbar}
      <div className="ledger-section__content">{children}</div>
      {footer ? <div className="ledger-section__footer">{footer}</div> : null}
    </section>
  );
}

LedgerSection.Toolbar = LedgerToolbar;
