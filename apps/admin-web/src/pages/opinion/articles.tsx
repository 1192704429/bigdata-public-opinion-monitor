import type { ClientSession } from "@aicp/auth";
import { requestRawApi } from "@aicp/api-client/common";
import { Button, Card, Drawer, Flex, Input, Select, Table, Tag, Typography } from "antd";
import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AdminPageLayout } from "../../shared/shell";

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
};

type PageResponse = { items: Article[]; total: number; page: number; pageSize: number };

type EventItem = {
  id: number;
  name: string;
  keyword: string;
  heatScore: number;
  articleCount: number;
  negativeCount: number;
};

type AlertItem = {
  id: number;
  severity: string;
  title: string;
  content: string;
  status: string;
  createTime: string;
};

type ArticleDetail = {
  article: Article;
  cleanText: string | null;
  cleanKeywords: string[];
  cleanStatus: string;
  cleanedAt: string | null;
  relatedEvents: EventItem[];
  relatedAlerts: AlertItem[];
};

async function getJson<T>(path: string): Promise<T> {
  return (await requestRawApi(path, { method: "GET" })).json() as Promise<T>;
}

const sentimentLabel: Record<string, { label: string; color: string }> = {
  positive: { label: "正面", color: "green" },
  neutral: { label: "中性", color: "blue" },
  negative: { label: "负面", color: "red" },
};

export function OpinionArticlesPage({
  session,
  tenantSlug,
  onLogout,
}: {
  session: ClientSession;
  tenantSlug: string;
  onLogout: () => void;
}): ReactNode {
  const [articles, setArticles] = useState<PageResponse>();
  const [keyword, setKeyword] = useState("");
  const [sentiment, setSentiment] = useState<string>();
  const [risk, setRisk] = useState<string>();
  const [detail, setDetail] = useState<ArticleDetail>();
  const [loading, setLoading] = useState(false);

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: "1", pageSize: "20" });
      if (keyword.trim()) query.set("keyword", keyword.trim());
      if (sentiment) query.set("sentiment", sentiment);
      if (risk) query.set("riskLevel", risk);
      setArticles(await getJson<PageResponse>(`/api/admin/opinion/articles?${query}`));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminPageLayout mainClassName="opinion-platform-main" session={session} tenantSlug={tenantSlug} onLogout={onLogout}>
      <Flex vertical gap={16} style={{ padding: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>舆情数据管理</Typography.Title>
        <Card size="small">
          <Flex wrap gap={12} align="center" style={{ marginBottom: 16 }}>
            <Input
              allowClear
              prefix={<Search size={14} />}
              placeholder="标题或正文关键词"
              style={{ width: 260 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => void load()}
            />
            <Select
              allowClear
              placeholder="情感倾向"
              style={{ width: 120 }}
              value={sentiment}
              onChange={setSentiment}
              options={[
                { value: "positive", label: "正面" },
                { value: "neutral", label: "中性" },
                { value: "negative", label: "负面" },
              ]}
            />
            <Select
              allowClear
              placeholder="风险"
              style={{ width: 100 }}
              value={risk}
              onChange={setRisk}
              options={[
                { value: "high", label: "高风险" },
                { value: "medium", label: "中风险" },
                { value: "low", label: "低风险" },
              ]}
            />
            <Button type="primary" onClick={() => void load()}>查询</Button>
          </Flex>
          <Table
            rowKey="id"
            size="small"
            loading={loading}
            pagination={articles ? { total: articles.total, pageSize: 20 } : false}
            dataSource={articles?.items ?? []}
            columns={[
              {
                title: "标题",
                dataIndex: "title",
                ellipsis: true,
                render: (value: string, row: Article) => (
                  <Typography.Link
                    onClick={() => void getJson<ArticleDetail>(`/api/admin/opinion/articles/${row.id}`).then(setDetail)}
                  >
                    {value}
                  </Typography.Link>
                ),
              },
              { title: "来源", dataIndex: "channel", width: 110 },
              {
                title: "发布时间",
                dataIndex: "publishTime",
                width: 160,
                render: (value: string | null) => value?.replace("T", " ").slice(0, 16) ?? "-",
              },
              { title: "命中关键词", dataIndex: "hitKeyword", width: 140, ellipsis: true },
              {
                title: "情感",
                dataIndex: "sentiment",
                width: 90,
                render: (value: string | null) => {
                  const meta = sentimentLabel[value ?? ""] ?? { label: "未分析", color: "default" };
                  return <Tag color={meta.color}>{meta.label}</Tag>;
                },
              },
              {
                title: "风险",
                dataIndex: "riskLevel",
                width: 90,
                render: (value: string | null) =>
                  value ? (
                    <Tag color={value === "high" ? "red" : value === "medium" ? "orange" : "green"}>
                      {value === "high" ? "高" : value === "medium" ? "中" : "低"}
                    </Tag>
                  ) : (
                    "-"
                  ),
              },
            ]}
          />
        </Card>
        <Drawer title={detail?.article.title} width={720} open={detail !== undefined} onClose={() => setDetail(undefined)}>
          <Flex vertical gap={14}>
            <Typography.Text>
              来源：{detail?.article.channel}　发布时间：{detail?.article.publishTime?.replace("T", " ") ?? "-"}
            </Typography.Text>
            <Typography.Link href={detail?.article.url} target="_blank">查看原文</Typography.Link>
            <Card size="small" title="清洗结果">
              <Typography.Paragraph>{detail?.cleanText ?? "尚未清洗"}</Typography.Paragraph>
              <Flex wrap gap={6}>
                {detail?.cleanKeywords.map((word) => (
                  <Tag key={word}>{word}</Tag>
                ))}
              </Flex>
            </Card>
            <Card size="small" title="关联热点事件">
              {detail?.relatedEvents.map((event) => (
                <Typography.Paragraph key={event.id}>
                  {event.name} · 热度 {event.heatScore}
                </Typography.Paragraph>
              ))}
            </Card>
            <Card size="small" title="关联预警">
              {detail?.relatedAlerts.map((alert) => (
                <Typography.Paragraph key={alert.id}>
                  {alert.title} · {alert.status}
                </Typography.Paragraph>
              ))}
            </Card>
          </Flex>
        </Drawer>
      </Flex>
    </AdminPageLayout>
  );
}
