import type { ClientSession } from "@aicp/auth";
import { requestRawApi } from "@aicp/api-client/common";
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminPageLayout } from "../../shared/shell";

type Task = { id: number; name: string; keywords: string };

type AlertRule = {
  id: number;
  name: string;
  type: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  taskId: number | null;
  taskName: string | null;
  keywords: string | null;
  windowHours: number;
};

type AlertRecord = {
  id: number;
  ruleId: number;
  ruleName: string | null;
  eventId: number | null;
  severity: string;
  title: string;
  content: string;
  currentValue: number;
  threshold: number;
  status: string;
  createTime: string;
};

type RuleForm = {
  name: string;
  type: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  taskId?: number;
  keywords?: string;
  windowHours: number;
};

const RULE_TYPES = [
  { value: "keyword_hit", label: "重点关键词命中", scope: "task" },
  { value: "negative_ratio", label: "负面舆情比例", scope: "task" },
  { value: "volume_growth", label: "舆情数量增长", scope: "task" },
  { value: "negative_count", label: "负面条数（热点事件）", scope: "event" },
  { value: "hot_score", label: "热度分值（热点事件）", scope: "event" },
] as const;

const WINDOW_OPTIONS = [
  { value: 6, label: "近 6 小时" },
  { value: 12, label: "近 12 小时" },
  { value: 24, label: "近 24 小时" },
  { value: 48, label: "近 48 小时" },
  { value: 72, label: "近 3 天" },
  { value: 168, label: "近 7 天" },
];

function severityTag(severity: string): ReactNode {
  const color = severity === "high" ? "red" : severity === "low" ? "blue" : "orange";
  const label = severity === "high" ? "高" : severity === "low" ? "低" : "中";
  return <Tag color={color}>{label}</Tag>;
}

function statusTag(status: string): ReactNode {
  const map: Record<string, { color: string; label: string }> = {
    open: { color: "red", label: "待处理" },
    handled: { color: "green", label: "已处理" },
    ignored: { color: "default", label: "已忽略" },
  };
  const item = map[status] ?? { color: "default", label: status };
  return <Tag color={item.color}>{item.label}</Tag>;
}

function typeLabel(type: string): string {
  return RULE_TYPES.find((item) => item.value === type)?.label ?? type;
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

export function OpinionAlertsPage({
  session,
  tenantSlug,
  onLogout,
}: {
  session: ClientSession;
  tenantSlug: string;
  onLogout: () => void;
}): ReactNode {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [records, setRecords] = useState<AlertRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [form] = Form.useForm<RuleForm>();
  const selectedType = Form.useWatch("type", form);

  const isTaskRule = useMemo(() => {
    const scope = RULE_TYPES.find((item) => item.value === selectedType)?.scope;
    return scope === "task";
  }, [selectedType]);

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const [ruleRows, recordRows, taskRows] = await Promise.all([
        json<AlertRule[]>("/api/admin/opinion/alert-rules"),
        json<AlertRecord[]>("/api/admin/opinion/alerts"),
        json<Task[]>("/api/admin/opinion/tasks"),
      ]);
      setRules(ruleRows);
      setRecords(recordRows);
      setTasks(taskRows.map((t) => ({ id: t.id, name: t.name, keywords: t.keywords })));
    } catch {
      message.error("预警数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = (): void => {
    setEditing(null);
    form.setFieldsValue({
      name: "",
      type: "keyword_hit",
      threshold: 1,
      severity: "medium",
      enabled: true,
      windowHours: 24,
      keywords: "",
    });
    setModalOpen(true);
  };

  const openEdit = (rule: AlertRule): void => {
    setEditing(rule);
    form.setFieldsValue({
      name: rule.name,
      type: rule.type,
      threshold: rule.threshold,
      severity: rule.severity,
      enabled: rule.enabled,
      taskId: rule.taskId ?? undefined,
      keywords: rule.keywords ?? "",
      windowHours: rule.windowHours,
    });
    setModalOpen(true);
  };

  const saveRule = async (): Promise<void> => {
    const values = await form.validateFields();
    const body = {
      name: values.name,
      type: values.type,
      threshold: values.type === "keyword_hit" ? 1 : values.threshold,
      severity: values.severity,
      enabled: values.enabled,
      taskId: isTaskRule ? values.taskId : null,
      keywords: values.keywords?.trim() || null,
      windowHours: values.windowHours,
    };
    try {
      if (editing) await mutate(`/api/admin/opinion/alert-rules/${editing.id}`, "PUT", body);
      else await mutate("/api/admin/opinion/alert-rules", "POST", body);
      message.success(editing ? "规则已更新" : "规则已创建");
      setModalOpen(false);
      await load();
    } catch {
      message.error("保存规则失败");
    }
  };

  const deleteRule = (rule: AlertRule): void => {
    Modal.confirm({
      title: "删除预警规则",
      content: `确定删除「${rule.name}」吗？`,
      onOk: async () => {
        try {
          await remove(`/api/admin/opinion/alert-rules/${rule.id}`);
          message.success("规则已删除");
          await load();
        } catch {
          message.error("删除失败");
        }
      },
    });
  };

  const evaluateNow = async (): Promise<void> => {
    setEvaluating(true);
    try {
      const response = await requestRawApi("/api/admin/opinion/alerts/evaluate", { method: "POST" });
      const created = (await response.json()) as number;
      message.success(created > 0 ? `评估完成，新增 ${created} 条预警` : "评估完成，暂无新预警");
      await load();
    } catch {
      message.error("预警评估失败");
    } finally {
      setEvaluating(false);
    }
  };

  const updateRecordStatus = async (record: AlertRecord, status: string): Promise<void> => {
    try {
      await mutate(`/api/admin/opinion/alerts/${record.id}/status`, "PUT", { status });
      message.success("状态已更新");
      await load();
    } catch {
      message.error("更新状态失败");
    }
  };

  const ruleColumns: ColumnsType<AlertRule> = [
    { title: "规则名称", dataIndex: "name", width: 160 },
    {
      title: "类型",
      dataIndex: "type",
      width: 180,
      render: (type: string) => typeLabel(type),
    },
    {
      title: "关联任务",
      dataIndex: "taskName",
      width: 140,
      render: (name: string | null) => name || "热点事件",
    },
    {
      title: "监测词",
      dataIndex: "keywords",
      ellipsis: true,
      render: (value: string | null) => value || "-",
    },
    {
      title: "窗口",
      dataIndex: "windowHours",
      width: 100,
      render: (hours: number) => WINDOW_OPTIONS.find((o) => o.value === hours)?.label ?? `${hours} 小时`,
    },
    {
      title: "阈值",
      dataIndex: "threshold",
      width: 90,
      render: (value: number, row) =>
        row.type === "negative_ratio" || row.type === "volume_growth" ? `${value}%` : value,
    },
    { title: "级别", dataIndex: "severity", width: 80, render: severityTag },
    {
      title: "状态",
      dataIndex: "enabled",
      width: 80,
      render: (enabled: boolean) => (enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: "操作",
      width: 140,
      fixed: "right",
      render: (_, row) => (
        <Space>
          <Button type="link" size="small" icon={<Pencil size={14} />} onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<Trash2 size={14} />} onClick={() => deleteRule(row)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const recordColumns: ColumnsType<AlertRecord> = [
    { title: "预警标题", dataIndex: "title", ellipsis: true },
    { title: "规则", dataIndex: "ruleName", width: 120, render: (v: string | null) => v || "-" },
    { title: "级别", dataIndex: "severity", width: 80, render: severityTag },
    {
      title: "当前值 / 阈值",
      width: 140,
      render: (_, row) => `${row.currentValue.toFixed(2)} / ${row.threshold}`,
    },
    { title: "状态", dataIndex: "status", width: 90, render: statusTag },
    { title: "时间", dataIndex: "createTime", width: 170, render: formatTime },
    {
      title: "操作",
      width: 160,
      fixed: "right",
      render: (_, row) =>
        row.status === "open" ? (
          <Space>
            <Button type="link" size="small" onClick={() => void updateRecordStatus(row, "handled")}>
              处理
            </Button>
            <Button type="link" size="small" onClick={() => void updateRecordStatus(row, "ignored")}>
              忽略
            </Button>
          </Space>
        ) : (
          "-"
        ),
    },
  ];

  const thresholdHint =
    selectedType === "negative_ratio"
      ? "负面舆情占比达到该百分比时触发（如 30 表示 30%）"
      : selectedType === "volume_growth"
        ? "相对上一统计周期的增长百分比（如 50 表示增长 50%）"
        : selectedType === "keyword_hit"
          ? "命中 1 条即触发（固定阈值，无需调高）"
          : "达到该数值时触发预警";

  return (
    <AdminPageLayout
      mainClassName="opinion-platform-main"
      session={session}
      tenantSlug={tenantSlug}
      onLogout={onLogout}
    >
      <Flex vertical gap={16} style={{ padding: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>舆情预警管理</Typography.Title>
        <Card>
          <Flex justify="space-between" align="center" wrap="gap">
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              配置重点监测关键词、负面舆情比例、舆情数量增长等规则；采集完成后或手动评估时自动生成预警记录。
            </Typography.Paragraph>
            <Space>
              <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>
                刷新
              </Button>
              <Button icon={<Play size={14} />} onClick={() => void evaluateNow()} loading={evaluating}>
                立即评估
              </Button>
            </Space>
          </Flex>
        </Card>

        <Tabs
          items={[
            {
              key: "rules",
              label: `预警规则 (${rules.length})`,
              children: (
                <Card
                  title="预警规则"
                  extra={
                    <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
                      新建规则
                    </Button>
                  }
                >
                  <Table
                    rowKey="id"
                    loading={loading}
                    columns={ruleColumns}
                    dataSource={rules}
                    scroll={{ x: 1200 }}
                    pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
                  />
                </Card>
              ),
            },
            {
              key: "records",
              label: `预警记录 (${records.filter((r) => r.status === "open").length} 待处理)`,
              children: (
                <Card title="预警记录">
                  <Table
                    rowKey="id"
                    loading={loading}
                    columns={recordColumns}
                    dataSource={records}
                    expandable={{
                      expandedRowRender: (row) => (
                        <Typography.Paragraph style={{ margin: 0 }}>{row.content}</Typography.Paragraph>
                      ),
                    }}
                    scroll={{ x: 1100 }}
                    pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
                  />
                </Card>
              ),
            },
          ]}
        />
      </Flex>

      <Modal
        title={editing ? "编辑预警规则" : "新建预警规则"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveRule()}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
            <Input placeholder="如：品牌负面激增预警" maxLength={100} />
          </Form.Item>
          <Form.Item name="type" label="预警类型" rules={[{ required: true }]}>
            <Select
              options={RULE_TYPES.map((item) => ({ value: item.value, label: item.label }))}
              onChange={(type) => {
                if (RULE_TYPES.find((item) => item.value === type)?.scope === "task") {
                  form.setFieldValue("windowHours", 24);
                }
                if (type === "keyword_hit") {
                  form.setFieldValue("threshold", 1);
                }
              }}
            />
          </Form.Item>
          {isTaskRule ? (
            <>
              <Form.Item
                name="taskId"
                label="采集任务"
                rules={[{ required: true, message: "请选择采集任务" }]}
              >
                <Select
                  placeholder="选择要监测的采集任务"
                  options={tasks.map((task) => ({ value: task.id, label: task.name }))}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
              {selectedType === "keyword_hit" ? (
                <Form.Item
                  name="keywords"
                  label="重点监测关键词"
                  extra="留空则使用任务配置的关键词，多个词用逗号分隔"
                >
                  <Input placeholder="如：质量问题,投诉,维权" />
                </Form.Item>
              ) : null}
              <Form.Item name="windowHours" label="统计窗口" rules={[{ required: true }]}>
                <Select options={WINDOW_OPTIONS} />
              </Form.Item>
            </>
          ) : (
            <Typography.Paragraph type="secondary">
              该类型基于热点事件评估，无需绑定采集任务。
            </Typography.Paragraph>
          )}
          {selectedType === "keyword_hit" ? (
            <Form.Item label="触发阈值" extra={thresholdHint}>
              <Input disabled value="1 条即触发" />
            </Form.Item>
          ) : (
            <Form.Item
              name="threshold"
              label="触发阈值"
              extra={thresholdHint}
              rules={[{ required: true, message: "请输入阈值" }]}
            >
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          )}
          <Form.Item name="severity" label="预警级别" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "low", label: "低" },
                { value: "medium", label: "中" },
                { value: "high", label: "高" },
              ]}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </AdminPageLayout>
  );
}
