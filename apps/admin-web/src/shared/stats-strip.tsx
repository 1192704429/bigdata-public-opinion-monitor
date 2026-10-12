import { type ReactNode } from "react";

import "./stats-strip.css";

export interface StatsChipProps {
  label: string;
  value: ReactNode;
  /** 数值尾部小字说明（如“份”“人”“个”），渲染为 value 后的 <small>。 */
  unit?: ReactNode;
  /** 右上角装饰图标（通常为 lucide 16px）或迷你图。 */
  icon?: ReactNode;
  /**
   * 语义色调：确定图标底色；risk / warning 额外把数值上色。
   * - default：主行动蓝
   * - success：成功绿
   * - risk：风险红
   * - warning：到期/待处理橙
   */
  tone?: "default" | "success" | "risk" | "warning";
  /** 数值的无障碍扩展文案（如“被培训任务引用 5 次”），只影响读屏，不改变视觉。 */
  valueLabel?: string;
  /** 可点击指标（运营概览跳转台账）。 */
  href?: string;
  /** 数值下方补充说明，对应概览指标卡备注行。 */
  hint?: ReactNode;
  className?: string;
}

function StatsChip({
  label,
  value,
  unit,
  icon,
  tone = "default",
  valueLabel,
  href,
  hint,
  className,
}: StatsChipProps): ReactNode {
  const iconTone =
    tone === "success"
      ? "green"
      : tone === "risk"
        ? "risk"
        : tone === "warning"
          ? "warning"
          : "blue";
  const valueTone =
    tone === "risk"
      ? " stat-chip-value--risk"
      : tone === "warning"
        ? " stat-chip-value--warning"
        : "";
  const chipClass = `stat-chip${className ? ` ${className}` : ""}`;
  const body = (
    <>
      <span className="stat-chip-head">
        <span className="stat-chip-label">{label}</span>
        {icon ? (
          <span className={`stat-chip-icon stat-chip-icon--${iconTone}`} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </span>
      <span
        className={`stat-chip-value${valueTone}`}
        {...(valueLabel ? { "aria-label": valueLabel } : {})}
      >
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      {hint ? <span className="stat-chip-hint">{hint}</span> : null}
    </>
  );
  if (href) {
    return (
      <a className={chipClass} href={href}>
        {body}
      </a>
    );
  }
  return <div className={chipClass}>{body}</div>;
}

/**
 * 统计带：指标卡网格（标签 / 辅助图标 / 大数字 / 可选备注）。
 *
 * `density="compact"` 是小指标卡模式：更矮的卡片、20px 数字、更窄列宽，
 * 给组织名册这类全高双栏工作面留出部门树与名册的垂直空间。
 *
 * 使用示例：
 * ```tsx
 * <StatsStrip aria-label="题库统计">
 *   <StatsStrip.Item label="题库总数" value={totals.banks} />
 *   <StatsStrip.Item label="可用" value={n} unit="份" icon={<Check size={16} />} tone="success" />
 * </StatsStrip>
 * <StatsStrip density="compact" aria-label="组织名册摘要">
 *   <StatsStrip.Item label="部门" value={n} unit="个" />
 * </StatsStrip>
 * ```
 *
 * 页面级作用域修饰符仍依赖 `.stats-strip`/`.stat-chip*` 类名，因此保留这些类名。
 */
export function StatsStrip({
  children,
  className,
  density = "default",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  density?: "default" | "compact";
  "aria-label"?: string;
}): ReactNode {
  const densityClass = density === "compact" ? " stats-strip--compact" : "";
  return (
    <section
      className={`stats-strip${densityClass}${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
    >
      {children}
    </section>
  );
}

StatsStrip.Item = StatsChip;
