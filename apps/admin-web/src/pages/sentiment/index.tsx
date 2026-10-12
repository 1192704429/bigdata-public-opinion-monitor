/**
 * 舆情监测页：按采集任务监测关键词，对公开渠道抓取的舆情条目做周/月聚合展示。
 * 数据来自 GET /api/admin/sentiment/report（情绪占比/趋势/话题/风险/关键词/渠道），
 * 采集统一从“采集任务”入口执行；本页按任务查看分析结果。
 */

import {
  getLatestSentimentMonthlyReport,
  getSentimentMonthlyReport,
  getSentimentReport,
  submitSentimentMonthlyReport,
  type SentimentHotTerm,
  type SentimentKeywordPerformance,
  type SentimentMonthlySection,
  type SentimentRelatedTerm,
  type SentimentReport,
  type SentimentReportBucket,
  type SentimentItem,
} from "@aicp/api-client/admin";
import { ApiError, requestRawApi } from "@aicp/api-client/common";
import type { ClientSession } from "@aicp/auth";
import {
  App as AntApp,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Flex,
  Row,
  Segmented,
  Select,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Cloud, FileText, Radar, RefreshCw, SearchCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { AdminPageLayout } from "../../shared/shell";
import { paths } from "../../routes";
import { MarkdownText } from "../opinion/markdown";
import { TrendAnalysisPanel } from "./trend-analysis";
import { WordCloudCanvas } from "./word-cloud";

type TrendBucket = "hour" | "day" | "week" | "month";

const { Text } = Typography;

/** 把接口错误转成可读消息（ApiError 用服务端 message，其余用兜底文案）。 */
function apiMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

const SENTIMENT_META: Record<string, { label: string; color: string }> = {
  positive: { label: "正面", color: "#2f7d57" },
  neutral: { label: "中性", color: "#8aa9c2" },
  negative: { label: "负面", color: "#b42318" },
};

const RISK_META: Record<string, { label: string; color: string }> = {
  high: { label: "高风险", color: "#b42318" },
  medium: { label: "中风险", color: "#c88a1a" },
  low: { label: "低风险", color: "#2f7d57" },
};

const TOPIC_LABELS: Record<string, string> = {
  privacy: "隐私/侵权",
  subscription: "订阅/收费",
  price: "价格/促销",
  form: "产品形态",
  quality: "质量/投诉",
  other: "其他",
};

const CHANNEL_LABELS: Record<string, string> = {
  ithome: "IT之家",
  csdn: "CSDN",
  eastmoney: "东方财富",
  heimaotousu: "黑猫投诉",
  kr36: "36氪",
  huxiu: "虎嗅",
  zol: "中关村在线",
  sohu: "搜狐科技",
  gdelt: "GDELT",
  bocha: "博查搜索",
  tianapi: "天聚数行",
  juhe: "聚合数据",
  smzdm: "什么值得买",
  news163: "网易",
  sina: "新浪",
  jd: "京东",
  tmall: "天猫",
};

/** 情绪元数据（key 不存在时按中性兜底，兼容旧数据/未知值）。 */
function sentimentMeta(key: string | null | undefined): { label: string; color: string } {
  const hit = key == null ? undefined : SENTIMENT_META[key];
  return hit ?? { label: "中性", color: "#8aa9c2" };
}

/** 风险元数据（key 不存在时按低风险兜底）。 */
function riskMeta(key: string | null | undefined): { label: string; color: string } {
  const hit = key == null ? undefined : RISK_META[key];
  return hit ?? { label: "低风险", color: "#2f7d57" };
}

function defaultRange(): [Dayjs, Dayjs] {
  return [dayjs().subtract(30, "day"), dayjs()];
}

type OpinionTaskOption = {
  id: number;
  name: string;
  keywords: string;
  enabled: boolean;
};

export function SentimentMonitorPage({
  session,
  tenantSlug,
  onLogout,
}: {
  session: ClientSession;
  tenantSlug: string;
  onLogout: () => void;
}): ReactNode {
  const { message } = AntApp.useApp();
  const [bucket, setBucket] = useState<TrendBucket>("week");
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(defaultRange());
  const [tasks, setTasks] = useState<OpinionTaskOption[]>([]);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [report, setReport] = useState<SentimentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [monthlyGenerating, setMonthlyGenerating] = useState(false);
  const [monthlySections, setMonthlySections] = useState<SentimentMonthlySection[]>([]);
  const [monthlyModel, setMonthlyModel] = useState("");
  const [monthlyGeneratedAt, setMonthlyGeneratedAt] = useState<string | null>(null);
  const [monthlyProgress, setMonthlyProgress] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const monthlyReportRef = useRef<HTMLDivElement>(null);

  const scrollToMonthlyReport = (): void => {
    monthlyReportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectedTask = tasks.find((task) => task.id === taskId) ?? null;

  const refresh = async (quiet = false): Promise<void> => {
    if (taskId == null) {
      setReport(null);
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const [from, to] = range ?? defaultRange();
      setReport(
        await getSentimentReport({
          from: from.format("YYYY-MM-DD"),
          to: to.format("YYYY-MM-DD"),
          bucket,
          taskId,
        }),
      );
    } catch (caught) {
      if (!quiet) message.error(apiMessage(caught, "舆情数据加载失败"));
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const response = await requestRawApi("/api/admin/opinion/tasks", { method: "GET" });
        const list = (await response.json()) as OpinionTaskOption[];
        setTasks(list);
        if (list.length > 0) {
          setTaskId((current) => current ?? list.find((task) => task.enabled)?.id ?? list[0].id);
        }
      } catch (caught) {
        message.error(apiMessage(caught, "采集任务加载失败"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, range, taskId]);

  const loadLatestMonthly = async (): Promise<void> => {
    if (taskId == null) {
      setMonthlySections([]);
      setMonthlyModel("");
      setMonthlyGeneratedAt(null);
      return;
    }
    try {
      const [from, to] = range ?? defaultRange();
      const state = await getLatestSentimentMonthlyReport({
        from: from.format("YYYY-MM-DD"),
        to: to.format("YYYY-MM-DD"),
        taskId,
      });
      if (state.found && state.sections.length > 0) {
        setMonthlySections(state.sections);
        setMonthlyModel(state.model);
        setMonthlyGeneratedAt(state.generatedAt ?? null);
        setMonthlyProgress(state.progress);
        setMonthlyTotal(state.total);
      } else if (!monthlyGenerating) {
        setMonthlySections([]);
        setMonthlyModel("");
        setMonthlyGeneratedAt(null);
        setMonthlyProgress(0);
        setMonthlyTotal(0);
      }
    } catch {
      // 静默失败，不影响主报表
    }
  };

  useEffect(() => {
    if (monthlyGenerating) return;
    void loadLatestMonthly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, range, monthlyGenerating]);

  const handleBucketChange = (value: TrendBucket): void => {
    if (value === "hour" && range) {
      const [from, to] = range;
      if (to.diff(from, "day") > 6) {
        setRange([to.subtract(6, "day"), to]);
        message.info("按小时统计最多展示 7 天，已自动缩短日期范围");
      }
    }
    setBucket(value);
  };

  const handleViewMonthlyReport = (): void => {
    setActiveTab("report");
    if (monthlySections.length === 0) {
      message.info("当前时间范围暂无舆情报告，请切换到「舆情报告」标签页生成");
      window.setTimeout(() => scrollToMonthlyReport(), 100);
      return;
    }
    window.setTimeout(() => {
      scrollToMonthlyReport();
      setMonthlyOpen(true);
    }, 100);
  };

  const handleMonthlyReport = async (): Promise<void> => {
    if (taskId == null) {
      message.warning("请先选择采集任务");
      return;
    }
    setMonthlyOpen(true);
    setMonthlyGenerating(true);
    setMonthlySections([]);
    setMonthlyModel("");
    setMonthlyGeneratedAt(null);
    setMonthlyProgress(0);
    setMonthlyTotal(0);
    try {
      const [from, to] = range ?? defaultRange();
      const { token } = await submitSentimentMonthlyReport({
        from: from.format("YYYY-MM-DD"),
        to: to.format("YYYY-MM-DD"),
        taskId: String(taskId),
        bucket,
      });
      // 后台逐模块生成（11 模块，9 个 AI 调用），轮询直至 done/error，期间展示已生成章节与进度
      const deadline = Date.now() + 10 * 60 * 1000;
      for (;;) {
        if (Date.now() > deadline) {
          message.error("舆情报告生成超时，请稍后在页面重试");
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 4000));
        const state = await getSentimentMonthlyReport(token);
        if (state.sections.length > 0) setMonthlySections(state.sections);
        if (state.total > 0) setMonthlyTotal(state.total);
        if (state.progress > 0) setMonthlyProgress(state.progress);
        if (state.status === "done") {
          setMonthlySections(state.sections);
          setMonthlyModel(state.model);
          setMonthlyGeneratedAt(new Date().toISOString());
          message.success("舆情报告生成完成，已保存");
          setActiveTab("report");
          window.setTimeout(() => scrollToMonthlyReport(), 150);
          break;
        }
        if (state.status === "error") {
          message.error(`舆情报告生成失败：${state.error || "未知错误"}`);
          break;
        }
      }
    } catch (caught) {
      message.error(apiMessage(caught, "舆情报告生成失败"));
    } finally {
      setMonthlyGenerating(false);
    }
  };

  const sentimentTotal = report ? (report.sentiment.positive ?? 0) + (report.sentiment.neutral ?? 0) + (report.sentiment.negative ?? 0) : 0;
  const pct = (n: number | undefined): string =>
    sentimentTotal > 0 ? `${(((n ?? 0) / sentimentTotal) * 100).toFixed(1)}%` : "0%";
  const positive = report?.sentiment.positive ?? 0;
  const negative = report?.sentiment.negative ?? 0;

  const itemColumns = [
    { title: "标题", dataIndex: "title", key: "title", ellipsis: true, render: (t: string, r: SentimentItem) => <a href={r.url} target="_blank" rel="noreferrer">{t}</a> },
    { title: "渠道", dataIndex: "channel", key: "channel", width: 110, render: (c: string) => CHANNEL_LABELS[c] ?? c },
    { title: "时间", dataIndex: "publishTime", key: "publishTime", width: 150, render: (t: string | null) => (t ? t.replace("T", " ").slice(0, 16) : "-") },
    {
      title: "命中关键词",
      dataIndex: "hitKeyword",
      key: "hitKeyword",
      width: 150,
      render: (b: string | null) => (b ? b.split(",").map((x) => <Tag key={x} color="blue">{x}</Tag>) : <Text type="secondary">未命中</Text>),
    },
    {
      title: "情绪",
      dataIndex: "sentiment",
      key: "sentiment",
      width: 80,
      render: (s: string | null) => {
        const meta = sentimentMeta(s);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "话题",
      dataIndex: "topic",
      key: "topic",
      width: 110,
      render: (t: string | null) => TOPIC_LABELS[t ?? "other"] ?? t,
    },
    {
      title: "风险",
      dataIndex: "risk",
      key: "risk",
      width: 90,
      render: (r: string | null) => {
        const meta = riskMeta(r);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "软文",
      dataIndex: "isSoftText",
      key: "isSoftText",
      width: 70,
      render: (v: number | null) => (v === 1 ? <Tag color="orange">疑似</Tag> : "-"),
    },
  ];

  return (
    <AdminPageLayout
      session={session}
      tenantSlug={tenantSlug}
      onLogout={onLogout}
      mainClassName="sentiment-page-main"
    >
      <Spin spinning={loading}>
      <Flex vertical gap={16} style={{ padding: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          舆情监测 · {selectedTask?.name ?? report?.taskName ?? "请选择任务"}
        </Typography.Title>
        {selectedTask?.keywords ? (
          <Text type="secondary">监测关键词：{selectedTask.keywords}</Text>
        ) : null}
        <Flex justify="space-between" align="center" wrap gap={12}>
          <Flex gap={12} align="center" wrap>
            <Select
              style={{ minWidth: 220 }}
              placeholder="选择采集任务"
              value={taskId ?? undefined}
              onChange={(value) => setTaskId(value)}
              options={tasks.map((task) => ({
                value: task.id,
                label: task.enabled ? task.name : `${task.name}（已停用）`,
              }))}
            />
            <Segmented
              value={bucket}
              onChange={(v) => handleBucketChange(v as TrendBucket)}
              options={[
                { label: "按小时", value: "hour" },
                { label: "按天", value: "day" },
                { label: "按周", value: "week" },
                { label: "按月", value: "month" },
              ]}
            />
            <DatePicker.RangePicker
              allowClear={false}
              value={range}
              onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
            />
          </Flex>
          <Flex gap={8}>
            <Button onClick={() => { window.location.assign(paths(tenantSlug).opinionTasks); }}>
              去任务配置抓取
            </Button>
            <Button icon={<FileText size={14} />} onClick={handleViewMonthlyReport}>
              查看报告
            </Button>
            <Button icon={<RefreshCw size={14} />} onClick={() => void refresh()}>
              刷新
            </Button>
          </Flex>
        </Flex>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            destroyInactiveTabPane={false}
            items={[
              {
                key: "overview",
                label: "监测概览",
                children: (
                  <Flex vertical gap={12}>
                    <Row gutter={[12, 12]}>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic title="声量（条）" value={report?.total ?? 0} suffix={<Text type="secondary">近{report?.from ?? ""}~{report?.to ?? ""}</Text>} />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic
                            title="负面声量"
                            value={negative}
                            valueStyle={{ color: negative > positive ? "#b42318" : undefined }}
                            suffix={<Text type="secondary">{pct(negative)}</Text>}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic title="正面声量" value={positive} valueStyle={{ color: "#2f7d57" }} suffix={<Text type="secondary">{pct(positive)}</Text>} />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic title="疑似软文" value={report?.softText ?? 0} valueStyle={{ color: "#c88a1a" }} suffix={<Text type="secondary">条</Text>} />
                        </Card>
                      </Col>
                    </Row>

                    <Row gutter={[12, 12]}>
                      <Col span={12}>
                        <Card size="small" title={<><SearchCheck size={14} /> 情绪占比</>} styles={{ body: { paddingTop: 8 } }}>
                          <Flex gap={8} wrap>
                            {(["positive", "neutral", "negative"] as const).map((key) => {
                              const meta = sentimentMeta(key);
                              const value = report?.sentiment[key] ?? 0;
                              const share = pct(value);
                              return (
                                <Flex key={key} vertical align="center" style={{ flex: 1, padding: 8, background: "#fafafa", borderRadius: 8 }}>
                                  <Text strong style={{ color: meta.color }}>{value}</Text>
                                  <Text type="secondary">{meta.label} {share}</Text>
                                </Flex>
                              );
                            })}
                          </Flex>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card size="small" title="风险分布" styles={{ body: { paddingTop: 8 } }}>
                          <Flex gap={8} wrap>
                            {(["high", "medium", "low"] as const).map((key) => {
                              const meta = riskMeta(key);
                              const value = report?.risk[key] ?? 0;
                              return (
                                <Flex key={key} vertical align="center" style={{ flex: 1, padding: 8, background: "#fafafa", borderRadius: 8 }}>
                                  <Text strong style={{ color: meta.color }}>{value}</Text>
                                  <Text type="secondary">{meta.label}</Text>
                                </Flex>
                              );
                            })}
                          </Flex>
                        </Card>
                      </Col>
                    </Row>

                    <Row gutter={[12, 12]}>
                      <Col span={12}>
                        <Card size="small" title="话题分布">
                          <Flex vertical gap={6}>
                            {Object.entries(report?.topic ?? {}).map(([key, value]) => (
                              <Flex key={key} justify="space-between" style={{ padding: "4px 8px", background: "#fafafa", borderRadius: 6 }}>
                                <Text>{TOPIC_LABELS[key] ?? key}</Text>
                                <Text strong>{value}</Text>
                              </Flex>
                            ))}
                          </Flex>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card size="small" title="渠道来源">
                          <Flex vertical gap={6}>
                            {Object.entries(report?.channels ?? {}).map(([key, value]) => (
                              <Flex key={key} justify="space-between" style={{ padding: "4px 8px", background: "#fafafa", borderRadius: 6 }}>
                                <Text>{CHANNEL_LABELS[key] ?? key}</Text>
                                <Text strong>{value}</Text>
                              </Flex>
                            ))}
                          </Flex>
                        </Card>
                      </Col>
                    </Row>
                  </Flex>
                ),
              },
              {
                key: "trends",
                label: "趋势分析",
                children: <TrendAnalysisPanel report={report} bucket={bucket} active={activeTab === "trends"} />,
              },
              {
                key: "keywords",
                label: "关键词分析",
                children: (
                  <Flex vertical gap={12}>
          <Card size="small" title={<><Cloud size={14} /> 关键词与词云分析</>}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Text strong>内容热词排行</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>从标题/摘要/正文提取</Text>
                <Table
                  style={{ marginTop: 8 }}
                  rowKey="term"
                  size="small"
                  pagination={false}
                  dataSource={report?.hotTerms ?? []}
                  locale={{ emptyText: "暂无热词（需有正文数据）" }}
                  columns={[
                    {
                      title: "排名",
                      key: "rank",
                      width: 56,
                      render: (_: unknown, __: SentimentHotTerm, index: number) => index + 1,
                    },
                    { title: "热词", dataIndex: "term", key: "term", render: (t: string) => <Text strong>{t}</Text> },
                    { title: "频次", dataIndex: "count", key: "count", width: 72 },
                    { title: "负面", dataIndex: "negative", key: "negative", width: 72, render: (v: number) => <Text style={{ color: v > 0 ? "#b42318" : undefined }}>{v}</Text> },
                    { title: "热度", dataIndex: "heatScore", key: "heatScore", width: 72 },
                  ]}
                />
              </Col>
              <Col span={12}>
                <Text strong>热点词云</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>字号与角度随频次变化 · 红色为负面倾向</Text>
                <WordCloudCanvas data={report?.wordCloud ?? []} height={320} />
              </Col>
            </Row>
            <div style={{ marginTop: 16 }}>
              <Text strong>关联词分析</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>同一篇文章内共现的高频词对</Text>
              <Flex vertical gap={8} style={{ marginTop: 10 }}>
                {(report?.relatedTerms ?? []).length > 0 ? (
                  (report?.relatedTerms ?? []).map((group: SentimentRelatedTerm) => (
                    <Flex key={group.term} gap={8} wrap align="center">
                      <Text strong>{group.term}</Text>
                      <Text type="secondary">→</Text>
                      {group.related.map((item) => (
                        <Tag key={`${group.term}-${item.word}`}>
                          {item.word} ({item.count})
                        </Tag>
                      ))}
                    </Flex>
                  ))
                ) : (
                  <Text type="secondary">暂无关联词（样本量较少时可能为空）</Text>
                )}
              </Flex>
            </div>
          </Card>

          <Card size="small" title={<><Radar size={14} /> 监测关键词声量与情绪</>}>
            <Table
              rowKey="keyword"
              size="small"
              pagination={false}
              dataSource={report?.keywordHits ?? []}
              columns={[
                { title: "关键词", dataIndex: "keyword", key: "keyword", render: (b: string) => <Text strong>{b}</Text> },
                { title: "声量", dataIndex: "total", key: "total", width: 90 },
                { title: "正面", dataIndex: "positive", key: "positive", width: 80, render: (v: number) => <Text style={{ color: "#2f7d57" }}>{v}</Text> },
                { title: "中性", dataIndex: "neutral", key: "neutral", width: 80 },
                { title: "负面", dataIndex: "negative", key: "negative", width: 80, render: (v: number) => <Text style={{ color: "#b42318" }}>{v}</Text> },
                {
                  title: "主导情绪",
                  dataIndex: "sentiment",
                  key: "sentiment",
                  width: 110,
                  render: (s: string, r: SentimentKeywordPerformance) => {
                    const meta = sentimentMeta(s);
                    return <Tag color={meta.color}>{meta.label}（{(r.total > 0 ? Math.round(((s === "positive" ? r.positive : s === "negative" ? r.negative : r.neutral) / r.total) * 100) : 0)}%）</Tag>;
                  },
                },
              ]}
            />
          </Card>
                  </Flex>
                ),
              },
              {
                key: "items",
                label: "条目明细",
                children: (
                  <Card size="small" title="条目明细（最新 30 条）">
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={report?.items ?? []}
                      columns={itemColumns}
                    />
                  </Card>
                ),
              },
              {
                key: "report",
                label: "舆情报告",
                children: (
                  <div ref={monthlyReportRef}>
            <Card
              size="small"
              title="舆情报告"
              extra={
                <Flex gap={8} align="center">
                  {monthlySections.length > 0 ? (
                    <Button type="link" size="small" onClick={() => setMonthlyOpen(true)}>
                      侧边展开阅读
                    </Button>
                  ) : null}
                  <Button size="small" loading={monthlyGenerating} onClick={() => void handleMonthlyReport()}>
                    {monthlySections.length > 0 ? "重新生成" : "生成报告"}
                  </Button>
                </Flex>
              }
            >
              {monthlyGenerating ? (
                <Flex vertical align="center" gap={12} style={{ padding: 24 }}>
                  <Spin />
                  <Text type="secondary">
                    正在逐模块生成舆情报告
                    {monthlyTotal > 0 ? `（${monthlyProgress}/${monthlyTotal}）` : "…"}
                  </Text>
                  {monthlySections.length > 0 ? (
                    <Flex vertical gap={12} style={{ width: "100%" }}>
                      {monthlySections.map((section, index) => (
                        <Card key={section.key} size="small" title={`${index + 1}. ${section.title}`}>
                          <MarkdownText content={section.content} tenantSlug={tenantSlug} />
                        </Card>
                      ))}
                    </Flex>
                  ) : null}
                </Flex>
              ) : monthlySections.length > 0 ? (
                <Flex vertical gap={12}>
                  <Text type="secondary">
                    模型：{monthlyModel || "—"}
                    {monthlyGeneratedAt ? ` · 生成于 ${dayjs(monthlyGeneratedAt).format("YYYY-MM-DD HH:mm")}` : ""}
                    {" · 基于当前日期范围与任务数据"}
                  </Text>
                  {monthlySections.map((section, index) => (
                    <Card key={section.key} size="small" title={`${index + 1}. ${section.title}`}>
                      <MarkdownText content={section.content} tenantSlug={tenantSlug} />
                    </Card>
                  ))}
                </Flex>
              ) : (
                <Text type="secondary">
                  当前时间范围暂无已保存的舆情报告。点击下方「生成报告」，将根据所选任务与监测关键词生成 AI 分析报告并持久化保存。
                </Text>
              )}
            </Card>
                  </div>
                ),
              },
            ]}
          />
        </Flex>
      </Spin>
      <Drawer
        title="舆情报告（按章节模块生成）"
        width={980}
        open={monthlyOpen}
        onClose={() => setMonthlyOpen(false)}
        destroyOnClose={false}
      >
        <Flex vertical gap={12}>
          {monthlyGenerating ? (
            <Flex vertical align="center" gap={12} style={{ padding: 32 }}>
              <Spin />
              <Text type="secondary">
                正在逐模块生成舆情报告（{monthlyTotal > 0 ? `已完成 ${monthlyProgress}/${monthlyTotal} 个模块` : "准备中…"}）：
                态势 / 周期回顾 / 情绪趋势 / 话题 / 风险 / 软文 / 关键词 / 研判 / 建议 / 时间线 / 来源
              </Text>
              {monthlySections.length > 0 ? (
                <div style={{ width: "100%" }}>
                  {monthlySections.map((section, index) => (
                    <Card key={section.key} size="small" title={`${index + 1}. ${section.title}`}>
                      <MarkdownText content={section.content} tenantSlug={tenantSlug} />
                    </Card>
                  ))}
                </div>
              ) : null}
            </Flex>
          ) : monthlySections.length > 0 ? (
            <>
              <Flex justify="space-between" align="center">
                <Text type="secondary">模型：{monthlyModel}</Text>
              </Flex>
              {monthlySections.map((section, index) => (
                <Card key={section.key} size="small" title={`${index + 1}. ${section.title}`}>
                  <MarkdownText content={section.content} tenantSlug={tenantSlug} />
                </Card>
              ))}
            </>
          ) : (
            <Text type="secondary">尚未生成，请在本标签页点击「生成报告」开始。</Text>
          )}
        </Flex>
      </Drawer>
    </AdminPageLayout>
  );
}
