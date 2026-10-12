import type { SentimentReport, SentimentReportBucket } from "@aicp/api-client/admin";
import { Card, Flex, Table, Tag, Typography } from "antd";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { TrendingUp } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

const { Text } = Typography;

type TrendBucket = "hour" | "day" | "week" | "month";

const BUCKET_LABEL: Record<TrendBucket, string> = {
  hour: "小时",
  day: "天",
  week: "周",
  month: "月",
};

type TrendAnalysisPanelProps = {
  report: SentimentReport | null;
  bucket: TrendBucket;
  active: boolean;
};

function periodLabel(bucket: SentimentReportBucket): string {
  return bucket.periodLabel || bucket.period;
}

function heatScore(bucket: SentimentReportBucket): number {
  if (bucket.heatScore != null) return bucket.heatScore;
  return bucket.total + bucket.negative * 1.5 + (bucket.highRisk ?? 0) * 2 + bucket.softText * 0.5;
}

function mountChart(
  canvas: HTMLCanvasElement,
  wrap: HTMLDivElement,
  config: ConstructorParameters<typeof Chart>[1],
): () => void {
  const chart = new Chart(canvas, config);
  let frame = 0;
  const observer = new ResizeObserver(() => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => chart.resize());
  });
  observer.observe(wrap);
  return () => {
    observer.disconnect();
    window.cancelAnimationFrame(frame);
    chart.destroy();
  };
}

export function TrendAnalysisPanel({ report, bucket, active }: TrendAnalysisPanelProps): ReactNode {
  const volumeRef = useRef<HTMLCanvasElement>(null);
  const volumeWrapRef = useRef<HTMLDivElement>(null);
  const heatRef = useRef<HTMLCanvasElement>(null);
  const heatWrapRef = useRef<HTMLDivElement>(null);
  const sentimentRef = useRef<HTMLCanvasElement>(null);
  const sentimentWrapRef = useRef<HTMLDivElement>(null);

  const trend = report?.trend ?? [];
  const labels = trend.map(periodLabel);

  useEffect(() => {
    const canvas = volumeRef.current;
    const wrap = volumeWrapRef.current;
    if (!active || !canvas || !wrap || trend.length === 0) return;
    return mountChart(canvas, wrap, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "声量（条）",
            data: trend.map((item) => item.total),
            backgroundColor: "rgba(37, 99, 235, 0.55)",
            borderColor: "#2563eb",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }, [active, trend, labels]);

  useEffect(() => {
    const canvas = heatRef.current;
    const wrap = heatWrapRef.current;
    if (!active || !canvas || !wrap || trend.length === 0) return;
    return mountChart(canvas, wrap, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "热度指数",
            data: trend.map((item) => heatScore(item)),
            borderColor: "#c88a1a",
            backgroundColor: "rgba(200, 138, 26, 0.12)",
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }, [active, trend, labels]);

  useEffect(() => {
    const canvas = sentimentRef.current;
    const wrap = sentimentWrapRef.current;
    if (!active || !canvas || !wrap || trend.length === 0) return;
    return mountChart(canvas, wrap, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "正面", data: trend.map((item) => item.positive), borderColor: "#2f7d57", backgroundColor: "rgba(47,125,87,0.08)", tension: 0.35 },
          { label: "中性", data: trend.map((item) => item.neutral), borderColor: "#8aa9c2", backgroundColor: "rgba(138,169,194,0.06)", tension: 0.35 },
          { label: "负面", data: trend.map((item) => item.negative), borderColor: "#b42318", backgroundColor: "rgba(180,35,24,0.08)", tension: 0.35 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "top" } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }, [active, trend, labels]);

  return (
    <Flex vertical gap={12}>
      <Text type="secondary">
        按{BUCKET_LABEL[bucket]}统计舆情声量与热度变化；热度指数综合声量、负面、高风险与软文权重计算。
      </Text>

      <Card size="small" title="声量变化趋势">
        <div ref={volumeWrapRef} style={{ position: "relative", height: 260, width: "100%" }}>
          <canvas ref={volumeRef} style={{ width: "100%", height: "100%" }} />
        </div>
      </Card>

      <Card size="small" title="热度变化趋势">
        <div ref={heatWrapRef} style={{ position: "relative", height: 240, width: "100%" }}>
          <canvas ref={heatRef} style={{ width: "100%", height: "100%" }} />
        </div>
      </Card>

      <Card size="small" title={`情绪趋势（按${BUCKET_LABEL[bucket]}）`}>
        <div ref={sentimentWrapRef} style={{ position: "relative", height: 240, width: "100%" }}>
          <canvas ref={sentimentRef} style={{ width: "100%", height: "100%" }} />
        </div>
      </Card>

      <Card
        size="small"
        title={<><TrendingUp size={14} /> 热点事件（声量跃升时段）</>}
      >
        <Table
          rowKey="period"
          size="small"
          pagination={false}
          dataSource={report?.hotEvents ?? []}
          locale={{ emptyText: "当前时间范围内未检测到明显声量跃升" }}
          columns={[
            { title: "时段", dataIndex: "periodLabel", key: "periodLabel", render: (v: string, r) => v || r.period },
            { title: "声量", dataIndex: "total", key: "total", width: 80 },
            {
              title: "环比变化",
              dataIndex: "changePct",
              key: "changePct",
              width: 100,
              render: (v: number) => (
                <Text style={{ color: v >= 0 ? "#b42318" : "#2f7d57" }}>
                  {v >= 0 ? "+" : ""}{v}%
                </Text>
              ),
            },
            { title: "热度", dataIndex: "heatScore", key: "heatScore", width: 80 },
            {
              title: "热门关键词",
              dataIndex: "topKeywords",
              key: "topKeywords",
              render: (keywords: SentimentReportBucket["topKeywords"]) => (
                <Flex gap={4} wrap>
                  {(keywords ?? []).map((item) => (
                    <Tag key={item.keyword} color="blue">{item.keyword} {item.count}</Tag>
                  ))}
                </Flex>
              ),
            },
          ]}
        />
      </Card>
    </Flex>
  );
}
