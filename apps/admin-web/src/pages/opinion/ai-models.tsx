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
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AdminPageLayout } from "../../shared/shell";

type AiModel = {
  id: number;
  configName: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cacheHitPricePerMillion: number;
  enabled: boolean;
  updateTime: string;
};

async function json<T>(path: string): Promise<T> {
  return (await requestRawApi(path, { method: "GET" })).json() as Promise<T>;
}

export function OpinionAiModelsPage({
  session,
  tenantSlug,
  onLogout,
}: {
  session: ClientSession;
  tenantSlug: string;
  onLogout: () => void;
}): ReactNode {
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      setModels(await json<AiModel[]>("/api/admin/ai-models"));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "模型配置加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openForm = (row?: AiModel): void => {
    setOpen(true);
    setEditingId(row?.id ?? null);
    if (!row) {
      form.resetFields();
      form.setFieldsValue({
        enabled: false,
        inputPricePerMillion: 0,
        outputPricePerMillion: 0,
        cacheHitPricePerMillion: 0,
      });
      return;
    }
    form.setFieldsValue({
      configName: row.configName,
      apiUrl: row.apiUrl,
      model: row.model,
      enabled: row.enabled,
      inputPricePerMillion: row.inputPricePerMillion,
      outputPricePerMillion: row.outputPricePerMillion,
      cacheHitPricePerMillion: row.cacheHitPricePerMillion,
      apiKey: "",
    });
  };

  const closeForm = (): void => {
    setOpen(false);
    setEditingId(null);
    form.resetFields();
  };

  const submit = async (): Promise<void> => {
    const values = await form.validateFields();
    const body = {
      configName: values.configName,
      apiUrl: values.apiUrl,
      apiKey: values.apiKey,
      model: values.model,
      inputPricePerMillion: values.inputPricePerMillion ?? 0,
      outputPricePerMillion: values.outputPricePerMillion ?? 0,
      cacheHitPricePerMillion: values.cacheHitPricePerMillion ?? 0,
      enabled: values.enabled ?? false,
    };
    try {
      await requestRawApi(
        editingId === null ? "/api/admin/ai-models" : `/api/admin/ai-models/${editingId}`,
        {
          method: editingId === null ? "POST" : "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      message.success(editingId === null ? "模型配置已创建" : "模型配置已保存");
      closeForm();
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const toggleEnabled = (row: AiModel, enabled: boolean): void => {
    void (async () => {
      setUpdatingId(row.id);
      try {
        await requestRawApi(`/api/admin/ai-models/${row.id}/enabled`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
        message.success(enabled ? `「${row.configName}」已设为打标模型` : `「${row.configName}」已停用`);
        await load();
      } catch (error) {
        message.error(error instanceof Error ? error.message : "状态更新失败");
      } finally {
        setUpdatingId(null);
      }
    })();
  };

  const deleteModel = (row: AiModel): void => {
    Modal.confirm({
      title: `删除模型配置「${row.configName}」？`,
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await requestRawApi(`/api/admin/ai-models/${row.id}`, { method: "DELETE" });
          message.success("已删除");
          await load();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "删除失败");
        }
      },
    });
  };

  return (
    <AdminPageLayout mainClassName="task-workspace" session={session} tenantSlug={tenantSlug} onLogout={onLogout}>
      <Flex vertical gap={16} style={{ padding: 16 }}>
        <Flex justify="space-between" align="center" wrap gap={12}>
          <div>
            <h2 style={{ margin: 0 }}>AI 模型配置</h2>
            <Typography.Text type="secondary">
              同一时间只能启用一个模型；启用的模型将用于采集后的文章 AI 打标（情感、风险、摘要等）。
            </Typography.Text>
          </div>
          <Button type="primary" icon={<Plus size={15} />} onClick={() => openForm()}>新增模型</Button>
        </Flex>

        <Card>
          <Table
            rowKey="id"
            loading={loading}
            pagination={false}
            dataSource={models}
            columns={[
              { title: "配置名称", dataIndex: "configName", width: 140 },
              { title: "模型", dataIndex: "model", width: 160 },
              { title: "接口地址", dataIndex: "apiUrl", ellipsis: true },
              { title: "Key", dataIndex: "apiKey", width: 140, render: (value: string) => value || "未配置" },
              {
                title: "打标模型",
                width: 120,
                render: (_: unknown, row: AiModel) => (
                  <Space size={8}>
                    <Tag color={row.enabled ? "success" : "default"}>{row.enabled ? "启用" : "停用"}</Tag>
                    <Switch
                      size="small"
                      checked={row.enabled}
                      loading={updatingId === row.id}
                      onChange={(checked) => toggleEnabled(row, checked)}
                    />
                  </Space>
                ),
              },
              {
                title: "操作",
                width: 140,
                render: (_: unknown, row: AiModel) => (
                  <Space>
                    <Button type="link" icon={<Pencil size={14} />} onClick={() => openForm(row)}>编辑</Button>
                    <Button type="link" danger onClick={() => deleteModel(row)}>删除</Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <Modal
          title={editingId === null ? "新增 AI 模型" : "编辑 AI 模型"}
          open={open}
          onCancel={closeForm}
          onOk={() => void submit()}
          destroyOnClose
          width={560}
        >
          <Form form={form} layout="vertical">
            <Form.Item name="configName" label="配置名称" rules={[{ required: true, message: "请输入配置名称" }]}>
              <Input placeholder="例如 通义千问生产环境" />
            </Form.Item>
            <Form.Item name="apiUrl" label="接口地址" rules={[{ required: true, message: "请输入接口地址" }]}>
              <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
            </Form.Item>
            <Form.Item name="model" label="模型 ID" rules={[{ required: true, message: "请输入模型 ID" }]}>
              <Input placeholder="qwen-plus" />
            </Form.Item>
            <Form.Item
              name="apiKey"
              label="API Key"
              rules={editingId === null ? [{ required: true, message: "请输入 API Key" }] : []}
              extra={editingId !== null ? "留空表示保留原 Key" : undefined}
            >
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Form.Item name="inputPricePerMillion" label="输入单价（每百万 token）">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="outputPricePerMillion" label="输出单价（每百万 token）">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="cacheHitPricePerMillion" label="缓存命中单价（每百万 token）">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="enabled" label="设为打标模型" valuePropName="checked" extra="启用后会自动停用其他模型">
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      </Flex>
    </AdminPageLayout>
  );
}
