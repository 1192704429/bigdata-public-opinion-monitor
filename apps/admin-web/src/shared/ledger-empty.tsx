import { Button, Empty, Typography } from "antd";
import { type ReactNode } from "react";

/** 台账空态统一两分支：无数据给引导文案（可选副文案），筛选无结果给「没有匹配 + 清除筛选」；不用 antd 默认空图，不做第三种文案分支（DESIGN.md「Ledger Section · 空态与加载」）。 */
export function LedgerEmpty({
  emptyText,
  hint,
  filtering = false,
  onClearFilters,
}: {
  emptyText: string;
  hint?: string;
  filtering?: boolean;
  onClearFilters?: (() => void) | undefined;
}): ReactNode {
  if (filtering) {
    return (
      <Empty className="empty-state" image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText}>
        {onClearFilters ? (
          <Button type="link" size="small" onClick={onClearFilters}>
            清除筛选条件
          </Button>
        ) : null}
        {hint ? (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {hint}
          </Typography.Paragraph>
        ) : null}
      </Empty>
    );
  }
  return (
    <Empty
      className="empty-state"
      description={
        hint ? (
          <>
            {emptyText}
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {hint}
            </Typography.Paragraph>
          </>
        ) : (
          emptyText
        )
      }
    />
  );
}
