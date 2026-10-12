import {
  createAccount,
  queryAccounts,
  type AccountDirectorySummary,
  updateAccountStatus,
} from "@aicp/api-client/admin";
import { ApiError } from "@aicp/api-client/common";
import { type ClientSession } from "@aicp/auth";
import type { ManagedAccount } from "@aicp/contracts";
import { Button, Flex, Form, Input, Modal, Select, Table, Tag } from "antd";
import { RefreshCw, Search } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { modalCloseButtonProps } from "../../shared/accessibility";
import { AdminPagination, useAdminCursorPagination } from "../../shared/admin-pagination";
import { LedgerIdentity } from "../../shared/ledger-identity";
import { LedgerEmpty } from "../../shared/ledger-empty";
import { LedgerOps } from "../../shared/ledger-ops";
import { OperationsHeader } from "../../shared/operations-header";
import { LedgerSection } from "../../shared/ledger-section";
import { AdminPageLayout } from "../../shared/shell";
import { StatsStrip } from "../../shared/stats-strip";
import "./accounts.css";

type StatusFilter = "all" | "active" | "disabled";

interface CreateAccountForm {
  loginName: string;
  displayName: string;
  initialPassword: string;
}

/**
 * 用户管理：创建登录账号、查看状态。
 */
export function AccountsAndRoles({
  session,
  tenantSlug,
  onLogout,
  onError,
  onSuccess,
}: {
  session: ClientSession;
  tenantSlug: string;
  onLogout: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}): ReactNode {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createForm] = Form.useForm<CreateAccountForm>();
  const [pending, setPending] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const accountQueryKey = JSON.stringify({ search: search.trim(), statusFilter });
  const loadAccountPage = useCallback(
    async (page: { limit: number; cursor?: string }) => {
      const result = await queryAccounts({
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter === "all" ? {} : { disabled: statusFilter === "disabled" }),
        ...page,
      });
      return result;
    },
    [search, statusFilter],
  );
  const accountPagination = useAdminCursorPagination<ManagedAccount, AccountDirectorySummary>({
    loadPage: async (page) => {
      const result = await loadAccountPage(page);
      return {
        items: result.accounts,
        hasMore: result.hasMore,
        ...(result.nextCursor === undefined ? {} : { nextCursor: result.nextCursor }),
        ...(result.summary === undefined ? {} : { meta: result.summary }),
      };
    },
    queryKey: accountQueryKey,
  });
  const accounts = accountPagination.items;
  const accountSummary = accountPagination.meta;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      accountPagination.reload();
    } catch (caught) {
      onError(caught instanceof ApiError ? caught.message : "账号数据暂时不可用");
    } finally {
      setLoading(false);
    }
  }, [accountPagination.reload, onError]);

  useEffect(() => {
    setLoading(false);
  }, []);

  async function submitCreateAccount(): Promise<void> {
    try {
      const values = await createForm.validateFields();
      setCreatePending(true);
      await createAccount(values);
      setCreateOpen(false);
      createForm.resetFields();
      onSuccess("用户已创建");
      accountPagination.reload();
    } catch (caught) {
      if (caught instanceof ApiError) onError(caught.message);
    } finally {
      setCreatePending(false);
    }
  }

  function closeCreateAccount(): void {
    if (!createPending) {
      setCreateOpen(false);
      createForm.resetFields();
    }
  }

  async function toggleAccountStatus(account: ManagedAccount): Promise<void> {
    try {
      setPending(true);
      await updateAccountStatus(account.id, { disabled: !account.disabled });
      onSuccess(account.disabled ? "账号已启用" : "账号已停用");
      await refresh();
    } catch (caught) {
      if (caught instanceof ApiError) onError(caught.message);
    } finally {
      setPending(false);
    }
  }

  const createAccountOverlay = (
    <Modal
      title="新建用户"
      open={createOpen}
      closable={modalCloseButtonProps}
      destroyOnClose
      confirmLoading={createPending}
      okText="创建用户"
      cancelText="取消"
      onCancel={closeCreateAccount}
      onOk={() => void submitCreateAccount()}
    >
      <Form<CreateAccountForm> form={createForm} layout="vertical">
        <Form.Item
          name="loginName"
          label="登录名"
          rules={[{ required: true, message: "请输入登录名" }]}
        >
          <Input autoComplete="off" placeholder="例如：zhangsan" />
        </Form.Item>
        <Form.Item
          name="displayName"
          label="显示名称"
          rules={[{ required: true, message: "请输入显示名称" }]}
        >
          <Input placeholder="请输入用户姓名或名称" />
        </Form.Item>
        <Form.Item
          name="initialPassword"
          label="初始密码"
          rules={[{ required: true, message: "请输入初始密码" }]}
        >
          <Input.Password autoComplete="new-password" placeholder="请输入初始密码" />
        </Form.Item>
      </Form>
    </Modal>
  );

  return (
    <AdminPageLayout
      mainClassName="task-workspace accounts-workspace"
      session={session}
      tenantSlug={tenantSlug}
      onLogout={onLogout}
      overlay={createAccountOverlay}
    >
      <OperationsHeader
        title="用户管理"
        description="创建和管理系统登录账号。"
        actions={
          <Flex gap={8}>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              新建用户
            </Button>
            <Button
              aria-label="刷新用户列表"
              loading={loading}
              onClick={() => void refresh()}
              icon={<RefreshCw size={15} />}
            >
              刷新
            </Button>
          </Flex>
        }
      />

      <StatsStrip aria-label="账号摘要">
        <StatsStrip.Item
          label="全部账号"
          value={accountSummary?.totalCount ?? "—"}
          unit="个"
        />
        <StatsStrip.Item
          label="已停用"
          value={accountSummary?.disabledCount ?? "—"}
          unit="不可登录"
          tone="risk"
        />
      </StatsStrip>

      <LedgerSection
        aria-label="系统账号台账"
        toolbar={
          <LedgerSection.Toolbar
            filters={
              <Select
                aria-label="按状态筛选账号"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                options={[
                  { value: "all", label: "全部状态" },
                  { value: "active", label: "正常" },
                  { value: "disabled", label: "已停用" },
                ]}
              />
            }
            search={
              <Input
                allowClear
                prefix={<Search size={14} />}
                value={search}
                placeholder="搜索姓名或登录名"
                aria-label="搜索账号"
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: 220 }}
              />
            }
            extra={
              <span
                aria-live="polite"
                style={{ fontSize: "12px", color: "var(--aicp-color-text-secondary)" }}
              >
                {loading && accounts.length === 0
                  ? "正在读取账号…"
                  : accountSummary === undefined
                    ? `本页 ${accounts.length} 个账号`
                    : `本页 ${accounts.length} / 共 ${accountSummary.totalCount} 个账号`}
              </span>
            }
          />
        }
        footer={
          <AdminPagination
            ariaLabel="账号列表分页"
            current={accountPagination.current}
            pageSize={accountPagination.pageSize}
            onChange={accountPagination.onChange}
            hasMore={accountPagination.hasMore}
            pageItemCount={accountPagination.pageItemCount}
          />
        }
      >
        <Table<ManagedAccount>
          className="account-role-table"
          aria-label="系统账号"
          rowKey="id"
          loading={loading || accountPagination.loading}
          pagination={false}
          scroll={{ x: 560 }}
          dataSource={accounts}
          locale={{
            emptyText:
              search.trim() || statusFilter !== "all" ? (
                <LedgerEmpty
                  filtering
                  emptyText="没有符合筛选条件的账号"
                  onClearFilters={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                />
              ) : (
                <LedgerEmpty emptyText="暂无账号" />
              ),
          }}
          columns={[
            {
              title: "账号",
              dataIndex: "displayName",
              fixed: "left",
              width: 280,
              render: (_, account) => (
                <LedgerIdentity
                  title={account.displayName}
                  subtitle={account.loginName}
                  disabled={account.disabled}
                />
              ),
            },
            {
              title: "状态",
              dataIndex: "disabled",
              width: 90,
              render: (disabled: boolean) => (
                <Tag color={disabled ? "default" : "success"}>{disabled ? "已停用" : "正常"}</Tag>
              ),
            },
            {
              title: "操作",
              key: "actions",
              fixed: "right",
              width: 96,
              align: "right",
              render: (_, account) => (
                <LedgerOps
                  actions={[
                    {
                      key: "status",
                      label: account.disabled ? "启用" : "停用",
                      ariaLabel: `${account.disabled ? "启用" : "停用"} ${account.displayName}`,
                      disabled: pending || account.loginName === session.account.loginName,
                      onClick: () => void toggleAccountStatus(account),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </LedgerSection>
    </AdminPageLayout>
  );
}
