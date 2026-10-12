import type { ClientSession } from "@aicp/auth";
import { requestRawApi } from "@aicp/api-client/common";
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Pencil, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { opinionTaskDetailPath } from "../../routes";
import { AdminPageLayout } from "../../shared/shell";

type Source = {
  id: number;
  name: string;
  code: string;
  type: string;
  providerType: string;
  url: string | null;
  endpoint: string | null;
  apiKey: string;
  configJson: string;
  remark: string | null;
  enabled: boolean;
};

type Task = {
  id: number;
  name: string;
  keywords: string;
  scheduleCron: string | null;
  sourceIds: number[];
  sourceNames: string[];
  enabled: boolean;
  runStatus: "idle" | "queued" | "running" | "success" | "failed";
  lastRecordId: number | null;
  lastRunMessage: string | null;
  lastRunTime: string | null;
};

type FormKind = "source" | "task";

type TaskFilters = {
  keyword: string;
  enabled: "all" | "enabled" | "disabled";
  schedule: "all" | "scheduled" | "manual";
  sourceId?: number;
};

export type OpinionConfigSection = "sources" | "tasks";

const SECTION_TITLES: Record<OpinionConfigSection, string> = {
  sources: "数据源管理",
  tasks: "采集任务",
};

const TASK_TABLE_SCROLL_X = 1380;

const ACTIVE_RUN_STATUSES = new Set<Task["runStatus"]>(["queued", "running"]);

function runStatusTag(status: Task["runStatus"] | undefined): ReactNode {
  if (status === "running") return <Tag color="processing">执行中</Tag>;
  if (status === "queued") return <Tag color="blue">排队中</Tag>;
  if (status === "success") return <Tag color="success">已完成</Tag>;
  if (status === "failed") return <Tag color="error">失败</Tag>;
  return <Tag>空闲</Tag>;
}

const CRON_PRESETS = [
  { value: "", label: "手动执行（不定时）" },
  { value: "0 0 8 * * *", label: "每天 08:00" },
  { value: "0 0 8,20 * * *", label: "每天 08:00 和 20:00" },
  { value: "0 0 12 * * *", label: "每天 12:00" },
  { value: "0 0 9 * * MON-FRI", label: "工作日 09:00" },
  { value: "0 0 9 * * MON", label: "每周一 09:00" },
  { value: "0 0 9 1 * *", label: "每月 1 日 09:00" },
] as const;

function scheduleLabel(cron: string | null | undefined): string {
  const normalized = cron?.trim() ?? "";
  return CRON_PRESETS.find((preset) => preset.value === normalized)?.label ?? (normalized || "手动执行");
}

function formatTime(value: string | null | undefined): string {
  return value?.replace("T", " ").slice(0, 19) || "-";
}

async function json<T>(path: string): Promise<T> {
  return (await requestRawApi(path, { method: "GET" })).json() as Promise<T>;
}

async function mutate(path: string, method: "POST" | "PUT", body: unknown): Promise<void> {
  await requestRawApi(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function remove(path: string): Promise<void> {
  await requestRawApi(path, { method: "DELETE" });
}

export function OpinionConfigSectionPage({
  section,
  session,
  tenantSlug,
  onLogout,
}: {
  section: OpinionConfigSection;
  session: ClientSession;
  tenantSlug: string;
  onLogout: () => void;
}): ReactNode {
  const navigate = useNavigate();
  const [sources, setSources] = useState<Source[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskFilters, setTaskFilters] = useState<TaskFilters>({
    keyword: "",
    enabled: "all",
    schedule: "all",
  });
  const [open, setOpen] = useState<FormKind | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<number | null>(null);
  const [updatingSourceId, setUpdatingSourceId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const filteredTasks = useMemo(() => {
    const keyword = taskFilters.keyword.trim();
    return tasks.filter((task) => {
      if (keyword && !task.name.includes(keyword) && !task.keywords.includes(keyword)) return false;
      if (taskFilters.enabled === "enabled" && !task.enabled) return false;
      if (taskFilters.enabled === "disabled" && task.enabled) return false;
      if (taskFilters.schedule === "scheduled" && !task.scheduleCron?.trim()) return false;
      if (taskFilters.schedule === "manual" && task.scheduleCron?.trim()) return false;
      if (taskFilters.sourceId && !task.sourceIds.includes(taskFilters.sourceId)) return false;
      return true;
    });
  }, [tasks, taskFilters]);

  const load = async (silent = false): Promise<void> => {
    if (!silent) setLoading(true);
    try {
      if (section === "sources") {
        setSources(await json<Source[]>("/api/admin/opinion/sources"));
        return;
      }
      const [nextTasks, nextSources] = await Promise.all([
        json<Task[]>("/api/admin/opinion/tasks"),
        json<Source[]>("/api/admin/opinion/sources"),
      ]);
      setTasks(nextTasks);
      setSources(nextSources);
    } catch (error) {
      if (!silent) message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [section]);

  useEffect(() => {
    if (section !== "tasks") return undefined;
    const hasActive = tasks.some((task) => ACTIVE_RUN_STATUSES.has(task.runStatus));
    if (!hasActive) return undefined;
    const timer = window.setInterval(() => {
      void load(true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [section, tasks]);

  const openForm = (kind: FormKind, row?: Source | Task): void => {
    setOpen(kind);
    setEditingId(row?.id ?? null);
    if (!row) {
      form.resetFields();
      form.setFieldsValue({
        enabled: true,
        type: "news",
        sourceIds: sources.filter((source) => source.enabled).map((source) => source.id),
        configJson: "{}",
        scheduleCron: "",
      });
      return;
    }
    if (kind === "source") {
      const source = row as Source;
      form.setFieldsValue({
        name: source.name,
        code: source.code,
        type: source.type,
        providerType: source.providerType,
        url: source.url,
        endpoint: source.endpoint,
        configJson: source.configJson || "{}",
        remark: source.remark,
        enabled: source.enabled,
        apiKey: "",
      });
    } else {
      const task = row as Task;
      form.setFieldsValue({
        name: task.name,
        keywords: task.keywords,
        scheduleCron: task.scheduleCron ?? "",
        sourceIds: task.sourceIds,
        enabled: task.enabled,
      });
    }
  };

  const closeForm = (): void => {
    setOpen(null);
    setEditingId(null);
    form.resetFields();
  };

  const submit = async (): Promise<void> => {
    const values = await form.validateFields();
    try {
      if (open === "source") {
        await mutate(
          editingId === null ? "/api/admin/opinion/sources" : `/api/admin/opinion/sources/${editingId}`,
          editingId === null ? "POST" : "PUT",
          {
            name: values.name,
            code: values.code,
            type: values.type,
            providerType: values.providerType,
            url: values.url,
            endpoint: values.endpoint,
            apiKey: values.apiKey,
            configJson: values.configJson,
            remark: values.remark,
            enabled: values.enabled ?? true,
          },
        );
      } else if (open === "task") {
        const scheduleCron =
          typeof values.scheduleCron === "string" ? values.scheduleCron.trim() : "";
        await mutate(
          editingId === null ? "/api/admin/opinion/tasks" : `/api/admin/opinion/tasks/${editingId}`,
          editingId === null ? "POST" : "PUT",
          {
            name: values.name,
            keywords: values.keywords,
            scheduleCron: scheduleCron.length > 0 ? scheduleCron : null,
            sourceIds: values.sourceIds,
            enabled: values.enabled ?? true,
          },
        );
      }
      message.success(editingId === null ? "已创建" : "已保存");
      closeForm();
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const toggleSourceStatus = (source: Source, enabled: boolean): void => {
    void (async () => {
      setUpdatingSourceId(source.id);
      try {
        await mutate(`/api/admin/opinion/sources/${source.id}`, "PUT", {
          name: source.name,
          code: source.code,
          type: source.type,
          providerType: source.providerType,
          url: source.url,
          endpoint: source.endpoint,
          configJson: source.configJson,
          remark: source.remark,
          enabled,
        });
        message.success(enabled ? `「${source.name}」已启用` : `「${source.name}」已停用`);
        await load();
      } catch (error) {
        message.error(error instanceof Error ? error.message : "状态更新失败");
      } finally {
        setUpdatingSourceId(null);
      }
    })();
  };

  const deleteSource = (source: Source): void => {
    Modal.confirm({
      title: `删除数据源「${source.name}」？`,
      content: "已被任务绑定的数据源不能直接删除，请先编辑任务解除绑定。",
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await remove(`/api/admin/opinion/sources/${source.id}`);
          message.success("数据源已删除");
          await load();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "删除失败");
        }
      },
    });
  };

  const runTask = (task: Task): void => {
    if (ACTIVE_RUN_STATUSES.has(task.runStatus)) return;
    void (async () => {
      setRunningTaskId(task.id);
      try {
        await mutate(`/api/admin/opinion/tasks/${task.id}/run`, "POST", {});
        message.success(`任务「${task.name}」已提交后台执行`);
        await load(true);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "任务提交失败");
      } finally {
        setRunningTaskId(null);
      }
    })();
  };

  const deleteTask = (task: Task): void => {
    Modal.confirm({
      title: `删除任务「${task.name}」？`,
      content: "删除后不可恢复，历史执行记录仍会保留。",
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await remove(`/api/admin/opinion/tasks/${task.id}`);
          message.success("任务已删除");
          await load();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "删除失败");
        }
      },
    });
  };

  const modalTitle = open === "source" ? "数据源配置" : "采集任务";

  const taskFilterBar = (
    <Flex wrap gap={12} align="center" style={{ marginBottom: 16 }}>
      <Input
        allowClear
        placeholder="任务名称 / 关键词"
        style={{ width: 200 }}
        value={taskFilters.keyword}
        onChange={(event) => setTaskFilters((prev) => ({ ...prev, keyword: event.target.value }))}
      />
      <Select
        style={{ width: 120 }}
        value={taskFilters.enabled}
        onChange={(value) => setTaskFilters((prev) => ({ ...prev, enabled: value }))}
        options={[
          { value: "all", label: "全部状态" },
          { value: "enabled", label: "已启用" },
          { value: "disabled", label: "已停用" },
        ]}
      />
      <Select
        style={{ width: 140 }}
        value={taskFilters.schedule}
        onChange={(value) => setTaskFilters((prev) => ({ ...prev, schedule: value }))}
        options={[
          { value: "all", label: "全部执行方式" },
          { value: "scheduled", label: "定时任务" },
          { value: "manual", label: "手动执行" },
        ]}
      />
      <Select
        allowClear
        placeholder="调用平台"
        style={{ width: 180 }}
        value={taskFilters.sourceId}
        onChange={(value) => setTaskFilters((prev) => ({ ...prev, sourceId: value }))}
        options={sources.map((source) => ({ value: source.id, label: source.name }))}
      />
      <Button icon={<RotateCcw size={14} />} onClick={() => setTaskFilters({ keyword: "", enabled: "all", schedule: "all" })}>
        重置
      </Button>
    </Flex>
  );

  const sectionContent =
    section === "sources" ? (
      <Card extra={<Button type="primary" icon={<Plus size={15} />} onClick={() => openForm("source")}>新增平台</Button>}>
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          dataSource={sources}
          columns={[
            { title: "名称", dataIndex: "name" },
            { title: "编码", dataIndex: "code" },
            { title: "适配器", dataIndex: "providerType" },
            { title: "接口地址", dataIndex: "endpoint", ellipsis: true },
            { title: "Key", dataIndex: "apiKey", render: (value: string) => (value || "未配置") },
            {
              title: "状态",
              dataIndex: "enabled",
              width: 140,
              render: (enabled: boolean, row: Source) => (
                <Space size={8}>
                  <Tag color={enabled ? "success" : "default"}>{enabled ? "启用" : "停用"}</Tag>
                  <Switch
                    size="small"
                    checked={enabled}
                    loading={updatingSourceId === row.id}
                    onChange={(checked) => toggleSourceStatus(row, checked)}
                  />
                </Space>
              ),
            },
            {
              title: "操作",
              render: (_: unknown, row: Source) => (
                <Space>
                  <Button type="link" icon={<Pencil size={14} />} onClick={() => openForm("source", row)}>编辑</Button>
                  <Button type="link" danger onClick={() => deleteSource(row)}>删除</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    ) : (
      <Card
        extra={
          <Button
            type="primary"
            disabled={sources.every((source) => !source.enabled)}
            icon={<Plus size={15} />}
            onClick={() => openForm("task")}
          >
            新建任务
          </Button>
        }
      >
        {taskFilterBar}
        <div className="opinion-task-table-wrap">
          <Table
            className="opinion-task-table"
            rowKey="id"
            loading={loading}
            pagination={false}
            dataSource={filteredTasks}
            scroll={{ x: TASK_TABLE_SCROLL_X }}
            columns={[
              { title: "任务名称", dataIndex: "name", width: 140 },
              {
                title: "状态",
                dataIndex: "enabled",
                width: 80,
                render: (enabled: boolean) => (
                  <Tag color={enabled ? "success" : "default"}>{enabled ? "启用" : "停用"}</Tag>
                ),
              },
              { title: "监测关键词", dataIndex: "keywords", width: 280, ellipsis: true },
              {
                title: "调用平台",
                width: 220,
                ellipsis: true,
                render: (_: unknown, row: Task) => row.sourceNames?.join("、") || "未绑定",
              },
              {
                title: "执行计划",
                width: 130,
                render: (_: unknown, row: Task) => (
                  <Tag color={row.scheduleCron?.trim() ? "blue" : "default"}>
                    {scheduleLabel(row.scheduleCron)}
                  </Tag>
                ),
              },
              {
                title: "执行状态",
                width: 100,
                render: (_: unknown, row: Task) => runStatusTag(row.runStatus),
              },
              {
                title: "最近执行",
                width: 170,
                render: (_: unknown, row: Task) => formatTime(row.lastRunTime),
              },
              {
                title: "执行明细",
                width: 100,
                render: (_: unknown, row: Task) => (
                  <Typography.Link onClick={() => navigate(opinionTaskDetailPath(row.id))}>
                    查看明细
                  </Typography.Link>
                ),
              },
              {
                title: "操作",
                key: "actions",
                width: 200,
                fixed: "right",
                align: "center",
                render: (_: unknown, row: Task) => (
                  <Space size={4}>
                    <Button
                      type="link"
                      icon={<Play size={14} />}
                      loading={runningTaskId === row.id}
                      disabled={ACTIVE_RUN_STATUSES.has(row.runStatus)}
                      onClick={() => runTask(row)}
                    >
                      运行
                    </Button>
                    <Button type="link" icon={<Pencil size={14} />} onClick={() => openForm("task", row)}>编辑</Button>
                    <Button type="link" danger icon={<Trash2 size={14} />} onClick={() => deleteTask(row)}>
                      删除
                    </Button>
                  </Space>
                ),
              },
            ] satisfies ColumnsType<Task>}
          />
        </div>
      </Card>
    );

  return (
    <AdminPageLayout mainClassName="task-workspace" session={session} tenantSlug={tenantSlug} onLogout={onLogout}>
      <Flex vertical gap={16} style={{ padding: 16 }}>
        <h2 style={{ margin: 0 }}>{SECTION_TITLES[section]}</h2>
        {sectionContent}

        <Modal title={editingId === null ? `新建${modalTitle}` : `编辑${modalTitle}`} open={open !== null} onCancel={closeForm} onOk={() => void submit()} destroyOnClose>
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
              <Input />
            </Form.Item>

            {open === "source" ? (
              <>
                <Form.Item name="code" label="来源编码" rules={[{ required: true, message: "请输入编码" }]}>
                  <Input disabled={editingId !== null} placeholder="例如 bocha、exa、gdelt" />
                </Form.Item>
                <Form.Item name="providerType" label="适配器类型" rules={[{ required: true, message: "请选择适配器" }]}>
                  <Select options={["ithome", "csdn", "eastmoney", "heimao", "gdelt", "bocha", "tianapi", "juhe", "anspire", "exa"].map((value) => ({ value, label: value }))} />
                </Form.Item>
                <Form.Item name="type" label="来源类型" rules={[{ required: true, message: "请选择来源类型" }]}>
                  <Select options={["news", "forum", "social", "search"].map((value) => ({ value, label: value }))} />
                </Form.Item>
                <Form.Item name="url" label="平台地址">
                  <Input placeholder="平台主页或文档地址" />
                </Form.Item>
                <Form.Item name="endpoint" label="实际接口地址">
                  <Input placeholder="支持 %s、%d 占位符；留空使用适配器默认地址" />
                </Form.Item>
                <Form.Item name="apiKey" label="API Key" extra={editingId !== null ? "留空表示保留原 Key" : "无需 Key 的公开平台留空"}>
                  <Input.Password placeholder="仅保存在服务端数据库" />
                </Form.Item>
                <Form.Item name="configJson" label="扩展配置 JSON">
                  <Input.TextArea rows={4} placeholder='例如 {"query":"AI录音","count":50}' />
                </Form.Item>
                <Form.Item name="remark" label="备注">
                  <Input />
                </Form.Item>
              </>
            ) : null}

            {open === "task" ? (
              <>
                <Form.Item
                  name="keywords"
                  label="监测关键词"
                  rules={[{ required: true, message: "请输入关键词" }]}
                  extra="多个关键词请用英文或中文逗号分隔，例如：产品名, 竞品A, 行业热词"
                >
                  <Input.TextArea rows={3} placeholder="关键词1, 关键词2, 关键词3" />
                </Form.Item>
                <Form.Item name="sourceIds" label="调用平台" rules={[{ required: true, type: "array", min: 1, message: "至少选择一个数据源" }]}>
                  <Select mode="multiple" options={sources.map((source) => ({ value: source.id, label: `${source.name}${source.enabled ? "" : "（已停用）"}`, disabled: !source.enabled }))} placeholder="选择本任务实际调用的平台" />
                </Form.Item>
                <Form.Item label="常用执行计划">
                  <Select
                    allowClear
                    placeholder="快速选择常用 Cron 表达式"
                    options={CRON_PRESETS.map((preset) => ({ value: preset.value, label: preset.label }))}
                    onChange={(value) => form.setFieldValue("scheduleCron", value ?? "")}
                  />
                </Form.Item>
                <Form.Item
                  name="scheduleCron"
                  label="定时表达式"
                  extra="留空表示仅手动执行；支持 Spring 六段 Cron，例如 0 0 8 * * *"
                >
                  <Input placeholder="0 0 8 * * *" />
                </Form.Item>
                <Typography.Text type="secondary">
                  任务名称即监测主题；执行明细在独立页面查看采集到的新闻标题与正文。
                </Typography.Text>
              </>
            ) : null}

            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      </Flex>
    </AdminPageLayout>
  );
}
