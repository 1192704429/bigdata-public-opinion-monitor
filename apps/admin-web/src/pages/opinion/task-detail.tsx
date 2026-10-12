import type { ClientSession } from "@aicp/auth";
import { requestRawApi } from "@aicp/api-client/common";
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Flex,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import { ArrowLeft, Play, RotateCcw, Search } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { paths } from "../../routes";
import { AdminPageLayout } from "../../shared/shell";

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

type CollectionRecord = {
  id: number;
  taskId: number;
  taskName: string;
  status: "queued" | "running" | "success" | "failed";
  collectedCount: number;
  duplicateCount: number;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  sourceNames: string[];
};

type ChannelRunStat = {
  channel: string;
  sourceName: string;
  fetched: number;
  retained: number;
  saved: number;
};

type CollectionRecordDetail = CollectionRecord & {
  channels: ChannelRunStat[];
};

type Article = {
  id: number;
  title: string;
  url: string;
  channel: string;
  publishTime: string | null;
  hitKeyword: string | null;
  sentiment: string | null;
  topic: string | null;
  riskLevel: string | null;
  summary: string | null;
  contentPreview: string | null;
};

type ArticleDetail = {
  article: Article;
  cleanText: string | null;
};

const RECORD_PAGE_SIZE = 10;
const ARTICLE_PAGE_SIZE = 10;
const ACTIVE_RUN_STATUSES = new Set<Task["runStatus"]>(["queued", "running"]);

const SENTIMENT_LABEL: Record<string, { label: string; color: string }> = {
  positive: { label: "正面", color: "green" },
  neutral: { label: "中性", color: "blue" },
  negative: { label: "负面", color: "red" },
};

function formatTime(value: string | null | undefined): string {
  return value?.replace("T", " ").slice(0, 19) || "-";
}

function recordStatusTag(status: CollectionRecord["status"]): ReactNode {
  if (status === "success") return <Tag color="success">成功</Tag>;
  if (status === "failed") return <Tag color="error">失败</Tag>;
  if (status === "running") return <Tag color="processing">执行中</Tag>;
  return <Tag>排队中</Tag>;
}

function taskRunStatusTag(status: Task["runStatus"]): ReactNode {
  if (status === "running") return <Tag color="processing">执行中</Tag>;
  if (status === "queued") return <Tag color="blue">排队中</Tag>;
  if (status === "success") return <Tag color="success">已完成</Tag>;
  if (status === "failed") return <Tag color="error">失败</Tag>;
  return <Tag>空闲</Tag>;
}

async function json<T>(path: string): Promise<T> {
  return (await requestRawApi(path, { method: "GET" })).json() as Promise<T>;
}

export function OpinionTaskDetailPage({
  session,
  tenantSlug,
  onLogout,
}: {
  session: ClientSession;
  tenantSlug: string;
  onLogout: () => void;
}): ReactNode {
  const navigate = useNavigate();
  const { taskId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const recordIdParam = searchParams.get("recordId");

  const [task, setTask] = useState<Task | null>(null);
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [recordPage, setRecordPage] = useState(1);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordStatus, setRecordStatus] = useState<string>();
  const [recordRange, setRecordRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [recordDetail, setRecordDetail] = useState<CollectionRecordDetail | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlePage, setArticlePage] = useState(1);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [expandedArticleId, setExpandedArticleId] = useState<number | null>(null);
  const [articleDetail, setArticleDetail] = useState<ArticleDetail | null>(null);
  const [submittingRun, setSubmittingRun] = useState(false);

  const loadTask = useCallback(async (): Promise<void> => {
    const result = await json<Task>(`/api/admin/opinion/tasks/${taskId}`);
    setTask(result);
  }, [taskId]);

  const buildRecordQuery = useCallback(
    (page: number): string => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(RECORD_PAGE_SIZE),
        taskId: String(taskId),
      });
      if (recordStatus) params.set("status", recordStatus);
      if (recordRange?.[0]) params.set("from", recordRange[0].format("YYYY-MM-DD"));
      if (recordRange?.[1]) params.set("to", recordRange[1].format("YYYY-MM-DD"));
      return params.toString();
    },
    [taskId, recordStatus, recordRange],
  );

  const loadRecords = useCallback(
    async (page = 1, silent = false): Promise<CollectionRecord[]> => {
      if (!silent) setRecordsLoading(true);
      try {
        const result = await json<{ items: CollectionRecord[]; total: number; page: number }>(
          `/api/admin/opinion/collection-records?${buildRecordQuery(page)}`,
        );
        setRecords(result.items);
        setRecordTotal(result.total);
        setRecordPage(result.page);
        return result.items;
      } catch (error) {
        if (!silent) message.error(error instanceof Error ? error.message : "执行记录加载失败");
        setRecords([]);
        setRecordTotal(0);
        return [];
      } finally {
        if (!silent) setRecordsLoading(false);
      }
    },
    [buildRecordQuery],
  );

  const loadRecordDetail = useCallback(async (recordId: number): Promise<void> => {
    try {
      setRecordDetail(await json<CollectionRecordDetail>(`/api/admin/opinion/collection-records/${recordId}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "执行详情加载失败");
      setRecordDetail(null);
    }
  }, []);

  const loadArticles = useCallback(async (recordId: number, page = 1): Promise<void> => {
    setArticlesLoading(true);
    try {
      const result = await json<{ items: Article[]; total: number; page: number }>(
        `/api/admin/opinion/collection-records/${recordId}/articles?page=${page}&pageSize=${ARTICLE_PAGE_SIZE}`,
      );
      setArticles(result.items);
      setArticleTotal(result.total);
      setArticlePage(result.page);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "采集数据加载失败");
      setArticles([]);
      setArticleTotal(0);
    } finally {
      setArticlesLoading(false);
    }
  }, []);

  const selectRecord = useCallback(
    async (recordId: number): Promise<void> => {
      setSelectedRecordId(recordId);
      setExpandedArticleId(null);
      setArticleDetail(null);
      setArticlePage(1);
      setSearchParams({ recordId: String(recordId) }, { replace: true });
      await loadRecordDetail(recordId);
      await loadArticles(recordId, 1);
    },
    [loadArticles, loadRecordDetail, setSearchParams],
  );

  useEffect(() => {
    void (async () => {
      try {
        await loadTask();
        const items = await loadRecords(1);
        const initialId = recordIdParam ? Number(recordIdParam) : items[0]?.id;
        if (initialId && !Number.isNaN(initialId)) {
          await selectRecord(initialId);
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : "任务加载失败");
      }
    })();
  }, [taskId]);

  useEffect(() => {
    if (!task || !ACTIVE_RUN_STATUSES.has(task.runStatus)) return undefined;
    const timer = window.setInterval(() => {
      void (async () => {
        await loadTask();
        await loadRecords(recordPage, true);
        if (selectedRecordId) await loadRecordDetail(selectedRecordId);
      })();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [task?.runStatus, taskId, recordPage, selectedRecordId, loadTask, loadRecords, loadRecordDetail]);

  const runTask = (): void => {
    if (!task || ACTIVE_RUN_STATUSES.has(task.runStatus)) return;
    void (async () => {
      setSubmittingRun(true);
      try {
        const response = await requestRawApi(`/api/admin/opinion/tasks/${task.id}/run`, { method: "POST" });
        const record = (await response.json()) as CollectionRecord;
        message.success(`任务「${task.name}」已提交后台执行`);
        await loadTask();
        const items = await loadRecords(1);
        const recordId = record.id ?? items[0]?.id;
        if (recordId) await selectRecord(recordId);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "任务提交失败");
      } finally {
        setSubmittingRun(false);
      }
    })();
  };

  const openArticleContent = (articleId: number): void => {
    void (async () => {
      if (expandedArticleId === articleId) {
        setExpandedArticleId(null);
        setArticleDetail(null);
        return;
      }
      try {
        const detail = await json<ArticleDetail>(`/api/admin/opinion/articles/${articleId}`);
        setExpandedArticleId(articleId);
        setArticleDetail(detail);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "正文加载失败");
      }
    })();
  };

  if (!task) {
    return (
      <AdminPageLayout session={session} tenantSlug={tenantSlug} onLogout={onLogout}>
        <Flex style={{ padding: 16 }}>加载中...</Flex>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout mainClassName="task-detail-workspace" session={session} tenantSlug={tenantSlug} onLogout={onLogout}>
      <div className="task-detail-container">
        <Flex justify="space-between" align="center" wrap gap={12} className="task-detail-header">
          <Space>
            <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(paths(tenantSlug).opinionTasks)}>
              返回采集任务
            </Button>
            <Typography.Title level={4} style={{ margin: 0 }}>{task.name}</Typography.Title>
            <Tag color={task.enabled ? "success" : "default"}>{task.enabled ? "启用" : "停用"}</Tag>
            {taskRunStatusTag(task.runStatus)}
          </Space>
          <Button
            type="primary"
            icon={<Play size={14} />}
            loading={submittingRun}
            disabled={ACTIVE_RUN_STATUSES.has(task.runStatus)}
            onClick={runTask}
          >
            立即运行
          </Button>
        </Flex>

        <Card size="small" className="task-detail-section">
          <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
            <Descriptions.Item label="监测关键词">{task.keywords}</Descriptions.Item>
            <Descriptions.Item label="调用平台">{task.sourceNames.join("、") || "未绑定"}</Descriptions.Item>
            <Descriptions.Item label="执行状态">{taskRunStatusTag(task.runStatus)}</Descriptions.Item>
            <Descriptions.Item label="最近执行">{formatTime(task.lastRunTime)}</Descriptions.Item>
            <Descriptions.Item label="执行摘要" span={3}>
              {task.lastRunMessage || "-"}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card size="small" title="执行记录" className="task-detail-section">
          <Flex wrap gap={12} align="center" className="task-detail-filters">
            <Select
              allowClear
              placeholder="执行状态"
              style={{ width: 120 }}
              value={recordStatus}
              onChange={setRecordStatus}
              options={[
                { value: "success", label: "成功" },
                { value: "failed", label: "失败" },
                { value: "running", label: "执行中" },
                { value: "queued", label: "排队中" },
              ]}
            />
            <DatePicker.RangePicker value={recordRange} onChange={(value) => setRecordRange(value as [Dayjs, Dayjs] | null)} />
            <Button type="primary" icon={<Search size={14} />} onClick={() => void loadRecords(1)}>查询</Button>
            <Button
              icon={<RotateCcw size={14} />}
              onClick={() => {
                setRecordStatus(undefined);
                setRecordRange(null);
                void loadRecords(1);
              }}
            >
              重置
            </Button>
          </Flex>
          <Table
            className="task-detail-table"
            rowKey="id"
            size="small"
            loading={recordsLoading}
            dataSource={records}
            pagination={{
              current: recordPage,
              pageSize: RECORD_PAGE_SIZE,
              total: recordTotal,
              showSizeChanger: false,
              onChange: (page) => void loadRecords(page),
            }}
            rowClassName={(row) => (row.id === selectedRecordId ? "ant-table-row-selected" : "")}
            onRow={(row) => ({
              onClick: () => void selectRecord(row.id),
              style: { cursor: "pointer" },
            })}
            columns={[
              { title: "执行时间", dataIndex: "startedAt", width: 170, render: formatTime },
              { title: "状态", dataIndex: "status", width: 90, render: recordStatusTag },
              { title: "调用平台", ellipsis: true, render: (_: unknown, row: CollectionRecord) => row.sourceNames?.join("、") || "-" },
              { title: "新增", dataIndex: "collectedCount", width: 70 },
              { title: "重复", dataIndex: "duplicateCount", width: 70 },
              { title: "结束时间", dataIndex: "finishedAt", width: 170, render: formatTime },
            ]}
          />
        </Card>

        {recordDetail ? (
          <>
            <Card size="small" title={`执行详情 · ${formatTime(recordDetail.startedAt)}`} className="task-detail-section">
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="状态">{recordStatusTag(recordDetail.status)}</Descriptions.Item>
                <Descriptions.Item label="新增 / 重复">
                  {recordDetail.collectedCount} / {recordDetail.duplicateCount}
                </Descriptions.Item>
                <Descriptions.Item label="调用平台" span={2}>
                  {recordDetail.sourceNames?.join("、") || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="说明" span={2}>
                  {recordDetail.message || "-"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="各平台采集统计" className="task-detail-section">
              <Table
                rowKey="channel"
                size="small"
                pagination={false}
                dataSource={recordDetail.channels}
                locale={{ emptyText: "暂无平台统计（重新执行后可看到各平台抓取情况）" }}
                columns={[
                  { title: "平台", dataIndex: "sourceName" },
                  { title: "抓取候选", dataIndex: "fetched", width: 100 },
                  { title: "去重后", dataIndex: "retained", width: 100 },
                  { title: "新增入库", dataIndex: "saved", width: 100 },
                ]}
              />
            </Card>

            <Card size="small" title={`采集数据（共 ${articleTotal} 条）`} className="task-detail-section task-detail-articles">
              <Flex vertical gap={16}>
                {articles.map((article) => (
                  <Card
                    key={article.id}
                    size="small"
                    type="inner"
                    className="task-detail-article-card"
                    title={
                      <Flex justify="space-between" gap={8} wrap>
                        <Typography.Link href={article.url} target="_blank" rel="noreferrer">
                          {article.title}
                        </Typography.Link>
                        <Space size={8} wrap>
                          <Tag>{article.channel}</Tag>
                          {article.sentiment && SENTIMENT_LABEL[article.sentiment] ? (
                            <Tag color={SENTIMENT_LABEL[article.sentiment].color}>
                              {SENTIMENT_LABEL[article.sentiment].label}
                            </Tag>
                          ) : null}
                          {article.hitKeyword ? <Tag color="blue">{article.hitKeyword}</Tag> : null}
                        </Space>
                      </Flex>
                    }
                  >
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                      发布时间：{formatTime(article.publishTime)}
                    </Typography.Paragraph>
                    <Typography.Paragraph style={{ marginBottom: 8 }}>
                      {article.contentPreview || article.summary || "暂无摘要"}
                    </Typography.Paragraph>
                    <Button type="link" size="small" onClick={() => openArticleContent(article.id)}>
                      {expandedArticleId === article.id ? "收起正文" : "查看完整正文"}
                    </Button>
                    {expandedArticleId === article.id && articleDetail?.article.id === article.id ? (
                      <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                        {articleDetail.cleanText || articleDetail.article.summary || "暂无正文"}
                      </Typography.Paragraph>
                    ) : null}
                  </Card>
                ))}
                {!articlesLoading && articles.length === 0 ? (
                  <Typography.Text type="secondary">
                    本次执行未新增数据。若任务刚执行完，请稍后刷新；历史记录可能无法精确关联到具体新闻。
                  </Typography.Text>
                ) : null}
              </Flex>
              {articleTotal > ARTICLE_PAGE_SIZE ? (
                <div className="task-detail-pagination">
                  <Pagination
                    current={articlePage}
                    pageSize={ARTICLE_PAGE_SIZE}
                    total={articleTotal}
                    showSizeChanger={false}
                    disabled={articlesLoading}
                    onChange={(page) => {
                      if (selectedRecordId) void loadArticles(selectedRecordId, page);
                    }}
                  />
                </div>
              ) : null}
            </Card>
          </>
        ) : null}
      </div>
    </AdminPageLayout>
  );
}
