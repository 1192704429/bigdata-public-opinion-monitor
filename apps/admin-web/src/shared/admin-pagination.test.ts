import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldHideAdminPagination } from "./admin-pagination-visibility";

void test("仅一页时隐藏分页", () => {
  assert.equal(
    shouldHideAdminPagination({
      current: 1,
      pageSize: 10,
      pageItemCount: 3,
      hasMore: false,
    }),
    true,
  );
});

void test("还有下一页时显示分页", () => {
  assert.equal(
    shouldHideAdminPagination({
      current: 1,
      pageSize: 10,
      pageItemCount: 10,
      hasMore: true,
    }),
    false,
  );
});

void test("明确关闭 hideOnSinglePage 时即使只有一页也显示", () => {
  assert.equal(
    shouldHideAdminPagination({
      current: 1,
      pageSize: 10,
      total: 4,
      hideOnSinglePage: false,
    }),
    false,
  );
});
