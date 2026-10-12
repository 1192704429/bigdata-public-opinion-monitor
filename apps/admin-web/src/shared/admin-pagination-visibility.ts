export interface AdminPaginationVisibilityInput {
  total?: number | undefined;
  current: number;
  pageSize: number;
  hasMore?: boolean | undefined;
  pageItemCount?: number | undefined;
  hideOnSinglePage?: boolean | undefined;
}

export function adminPaginationEffectiveTotal({
  total,
  current,
  pageSize,
  hasMore = false,
  pageItemCount,
}: AdminPaginationVisibilityInput): number {
  return (
    total ??
    (hasMore
      ? current * pageSize + 1
      : Math.max(0, (current - 1) * pageSize + (pageItemCount ?? pageSize)))
  );
}

/** 只有一页且允许隐藏时不渲染分页，避免台账 footer 留下空条和分割线。 */
export function shouldHideAdminPagination(input: AdminPaginationVisibilityInput): boolean {
  if (input.hideOnSinglePage === false) return false;
  return adminPaginationEffectiveTotal(input) <= input.pageSize;
}
