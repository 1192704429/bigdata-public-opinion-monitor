import type { ClientSession } from "@aicp/auth";
import { requestRawApi } from "@aicp/api-client/common";
import { Card, Col, Flex, Row, Statistic, Table, Tag, Typography } from "antd";
import { useEffect, useState, type ReactNode } from "react";

import { AdminPageLayout } from "../../shared/shell";

type Dashboard = {
  total: number;
  todayAdded: number;
  positive: number;
  neutral: number;
  negative: number;
  highRisk: number;
  topicCount: number;
  activeTaskCount: number;
  channels: { name: string; value: number }[];
};

type Analysis = {
  cleanedTotal: number;
  pendingClean: number;
  wordCloud: { word: string; value: number }[];
  trend: { date: string; total: number; positive: number; negative: number }[];
  hotTopics: { keyword: string; articleCount: number; negativeCount: number; heatScore: number }[];
};

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

type ReportItem = { id: number; name: string; type: string; createTime: string };

async function getJson<T>(path: string): Promise<T> {
  return (await requestRawApi(path, { method: "GET" })).json() as Promise<T>;
}

export function OpinionPlatformPage({
  session,
  tenantSlug,
  onLogout,
}: {
  session: ClientSession;
  tenantSlug: string;
  onLogout: () => void;
}): ReactNode {
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [analysis, setAnalysis] = useState<Analysis>();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);

  const load = async (): Promise<void> => {
    const [summary, analysisResult, eventRows, alertRows, reportRows] = await Promise.all([
      getJson<Dashboard>("/api/admin/opinion/dashboard"),
      getJson<Analysis>("/api/admin/opinion/analysis"),
      getJson<EventItem[]>("/api/admin/opinion/events"),
      getJson<AlertItem[]>("/api/admin/opinion/alerts"),
      getJson<ReportItem[]>("/api/admin/opinion/reports"),
    ]);
    setDashboard(summary);
    setAnalysis(analysisResult);
    setEvents(eventRows);
    setAlerts(alertRows);
    setReports(reportRows);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AdminPageLayout mainClassName="opinion-platform-main" session={session} tenantSlug={tenantSlug} onLogout={onLogout}>
      <Flex vertical gap={16} style={{ padding: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>网络舆情分析与热点监测</Typography.Title>
        <Row gutter={[12, 12]}>
          {[
            ["舆情总量", dashboard?.total],
            ["今日新增", dashboard?.todayAdded],
            ["正面舆情", dashboard?.positive],
            ["负面舆情", dashboard?.negative],
            ["高风险舆情", dashboard?.highRisk],
            ["启用采集任务", dashboard?.activeTaskCount],
          ].map(([title, value]) => (
            <Col xs={12} lg={6} key={String(title)}>
              <Card size="small">
                <Statistic title={String(title)} value={Number(value ?? 0)} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={12}>
            <Card size="small" title="平台来源分布">
              <Flex vertical gap={8}>
                {dashboard?.channels.map((item) => (
                  <Flex key={item.name} justify="space-between">
                    <Typography.Text>{item.name}</Typography.Text>
                    <Typography.Text strong>{item.value} 条</Typography.Text>
                  </Flex>
                ))}
              </Flex>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title="情感分布">
              <Flex gap={24}>
                <Statistic title="正面" value={dashboard?.positive ?? 0} valueStyle={{ color: "#389e0d" }} />
                <Statistic title="中性" value={dashboard?.neutral ?? 0} />
                <Statistic title="负面" value={dashboard?.negative ?? 0} valueStyle={{ color: "#cf1322" }} />
              </Flex>
            </Card>
          </Col>
        </Row>
        <Card size="small" title="数据清洗与热点分析">
          <Row gutter={[12, 12]}>
            <Col xs={24} lg={8}>
              <Statistic title="已清洗文章" value={analysis?.cleanedTotal ?? 0} />
              <Typography.Text type="secondary">待处理 {analysis?.pendingClean ?? 0} 条</Typography.Text>
            </Col>
            <Col xs={24} lg={8}>
              <Typography.Text strong>热点话题排行</Typography.Text>
              <Flex vertical gap={5} style={{ marginTop: 10 }}>
                {analysis?.hotTopics.slice(0, 6).map((item, index) => (
                  <Flex key={item.keyword} justify="space-between">
                    <Typography.Text>{index + 1}. {item.keyword}</Typography.Text>
                    <Typography.Text>{item.articleCount} 条 · 热度 {item.heatScore}</Typography.Text>
                  </Flex>
                ))}
              </Flex>
            </Col>
            <Col xs={24} lg={8}>
              <Typography.Text strong>关键词词云（Top 20）</Typography.Text>
              <Flex wrap gap={6} style={{ marginTop: 10 }}>
                {analysis?.wordCloud.slice(0, 20).map((item) => (
                  <Tag key={item.word} color="blue">
                    {item.word} {item.value}
                  </Tag>
                ))}
              </Flex>
            </Col>
          </Row>
        </Card>
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={12}>
            <Card size="small" title="热点事件">
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: "暂无热点事件" }}
                dataSource={events.slice(0, 8)}
                columns={[
                  { title: "事件", dataIndex: "name" },
                  { title: "声量", dataIndex: "articleCount", width: 70 },
                  { title: "负面", dataIndex: "negativeCount", width: 70 },
                  { title: "热度", dataIndex: "heatScore", width: 90 },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title="舆情预警">
              <Flex vertical gap={8}>
                {alerts.slice(0, 6).map((item) => (
                  <Flex key={item.id} justify="space-between" gap={8}>
                    <Tag color={item.severity === "high" ? "red" : item.severity === "low" ? "blue" : "orange"}>
                      {item.severity === "high" ? "高" : item.severity === "low" ? "低" : "中"}
                    </Tag>
                    <Typography.Text ellipsis style={{ flex: 1 }}>{item.title}</Typography.Text>
                    <Typography.Text type="secondary">{item.status}</Typography.Text>
                  </Flex>
                ))}
              </Flex>
            </Card>
          </Col>
        </Row>
        <Card size="small" title="舆情分析报告">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: "暂无报告" }}
            dataSource={reports.slice(0, 8)}
            columns={[
              { title: "报告名称", dataIndex: "name" },
              { title: "类型", dataIndex: "type", width: 100 },
              {
                title: "生成时间",
                dataIndex: "createTime",
                width: 180,
                render: (value: string) => value.replace("T", " ").slice(0, 16),
              },
            ]}
          />
        </Card>
      </Flex>
    </AdminPageLayout>
  );
}
