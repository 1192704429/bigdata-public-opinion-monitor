import { Pagination } from "antd";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  adminPaginationEffectiveTotal,
  shouldHideAdminPagination,
} from "./admin-pagination-visibility";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

export interface AdminCursorPage<T, M = undefined> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
  meta?: M;
}

/**
 * 管理端游标分页状态：页码只用于 Ant 交互，跨页只保存服务端返回的 nextCursor。
 * queryKey 变化会丢弃旧游标，避免搜索或筛选条件复用上一组结果的位置。
 */
export function useAdminCursorPagination<T, M = undefined>({
  loadPage,
  queryKey,
  initialPageSize = 10,
}: {
  loadPage: (input: { limit: number; cursor?: string }) => Promise<AdminCursorPage<T, M>>;
  queryKey: string;
  initialPageSize?: number;
}): {
  items: T[];
  current: number;
  pageSize: number;
  /** 游标分页没有服务端 total 时保持 undefined，避免把导航上限误报成真实总数。 */
  total?: number;
  pageItemCount: number;
  hasMore: boolean;
  meta?: M;
  loading: boolean;
  error?: unknown;
  reload: () => void;
  onChange: (page: number, pageSize: number) => void;
} {
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [cursors, setCursors] = useState<Record<number, string | undefined>>({ 1: undefined });
  const [page, setPage] = useState<AdminCursorPage<T, M>>({ items: [], hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [reloadVersion, setReloadVersion] = useState(0);
  const requestVersion = useRef(0);
  const lastRequestKey = useRef<string | undefined>(undefined);
  // 页面通常会以内联闭包传入 loadPage；读取最新闭包，但不让其引用变化触发重复请求。
  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;
  const currentCursor = cursors[current];

  useEffect(() => {
    lastRequestKey.current = undefined;
    requestVersion.current += 1;
    setCurrent(1);
    setCursors({ 1: undefined });
    setPage({ items: [], hasMore: false });
    setError(undefined);
  }, [queryKey]);

  useEffect(() => {
    if (current > 1 && currentCursor === undefined) return;
    const requestKey = JSON.stringify([current, currentCursor, pageSize, queryKey, reloadVersion]);
    // StrictMode 或父组件重渲染可能重复执行 effect；同一游标查询只发一次请求。
    if (lastRequestKey.current === requestKey) return;
    lastRequestKey.current = requestKey;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(undefined);
    void loadPageRef
      .current({
        limit: pageSize,
        ...(currentCursor === undefined ? {} : { cursor: currentCursor }),
      })
      .then((nextPage) => {
        if (requestVersion.current !== version) return;
        setPage(nextPage);
        if (nextPage.nextCursor !== undefined) {
          setCursors((currentCursors) => ({
            ...currentCursors,
            [current + 1]: nextPage.nextCursor,
          }));
        }
      })
      .catch((caught: unknown) => {
        if (requestVersion.current === version) setError(caught);
      })
      .finally(() => {
        if (requestVersion.current === version) setLoading(false);
      });
  }, [current, currentCursor, pageSize, queryKey, reloadVersion]);

  const reload = useCallback(() => setReloadVersion((version) => version + 1), []);
  const onChange = useCallback(
    (nextPage: number, nextPageSize: number) => {
      if (nextPageSize !== pageSize) {
        setPageSize(nextPageSize);
        setCurrent(1);
        setCursors({ 1: undefined });
        return;
      }
      setCurrent(nextPage);
    },
    [pageSize],
  );
  return {
    items: page.items,
    current,
    pageSize,
    pageItemCount: page.items.length,
    hasMore: page.hasMore,
    ...(page.meta === undefined ? {} : { meta: page.meta }),
    loading,
    ...(error === undefined ? {} : { error }),
    reload,
    onChange,
  };
}

/** 管理端台账统一分页：保持 Ant Pagination 的交互，同时统一页大小和总数文案。 */
export function AdminPagination({
  total,
  current,
  pageSize,
  onChange,
  className,
  ariaLabel = "列表分页",
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showSizeChanger = true,
  showTotal,
  hasMore = false,
  pageItemCount,
  hideOnSinglePage = true,
  disabled = false,
  simple = false,
}: {
  /** 未提供时表示服务端总数未知，组件只用内部导航上限驱动下一页。 */
  total?: number;
  current: number;
  pageSize: number;
  onChange: (page: number, pageSize: number) => void;
  className?: string;
  ariaLabel?: string;
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  showTotal?: (total: number, range: [number, number]) => ReactNode;
  hasMore?: boolean;
  pageItemCount?: number;
  hideOnSinglePage?: boolean;
  disabled?: boolean;
  simple?: boolean;
}): ReactNode {
  const effectiveTotal = adminPaginationEffectiveTotal({
    total,
    current,
    pageSize,
    hasMore,
    pageItemCount,
  });
  const defaultShowTotal =
    total === undefined
      ? () => `第 ${current} 页`
      : (count: number, range: [number, number]) => `${range[0]}-${range[1]} / 共 ${count} 条`;

  if (
    shouldHideAdminPagination({
      total,
      current,
      pageSize,
      hasMore,
      pageItemCount,
      hideOnSinglePage,
    })
  ) {
    return null;
  }

  return (
    <div className={`admin-pagination${className ? ` ${className}` : ""}`}>
      <Pagination
        aria-label={ariaLabel}
        current={current}
        pageSize={pageSize}
        total={effectiveTotal}
        responsive
        showSizeChanger={showSizeChanger}
        hideOnSinglePage={hideOnSinglePage}
        disabled={disabled}
        simple={simple}
        showTotal={showTotal ?? defaultShowTotal}
        pageSizeOptions={pageSizeOptions}
        onChange={onChange}
      />
    </div>
  );
}
