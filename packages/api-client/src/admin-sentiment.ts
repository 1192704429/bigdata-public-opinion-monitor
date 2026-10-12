import type { PublicHttpOperationResponse } from "@aicp/contracts";

import { requestOperation } from "./common";

export type SentimentReport = PublicHttpOperationResponse<"getSentimentReport">;
export type SentimentReportBucket = SentimentReport["trend"][number];
export type SentimentKeywordPerformance = SentimentReport["keywordHits"][number];
export type SentimentWordCloudItem = SentimentReport["wordCloud"][number];
export type SentimentHotTerm = SentimentReport["hotTerms"][number];
export type SentimentRelatedTerm = SentimentReport["relatedTerms"][number];
export type SentimentItem = SentimentReport["items"][number];

export async function markSentiment(taskId?: number): Promise<{ marked: number }> {
  return requestOperation("markSentiment", { query: compactQuery({ taskId }) });
}

export async function aiMarkSentiment(limit = 50, taskId?: number): Promise<{ marked: number }> {
  return requestOperation("aiMarkSentiment", { query: compactQuery({ limit, taskId }) });
}

/** 过滤未传的可选 body 键。 */
function compactBody(input: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""),
  );
}

export interface SentimentMonthlySection {
  key: string;
  title: string;
  content: string;
}

export interface SentimentMonthlyReportState {
  status: "running" | "done" | "error";
  sections: SentimentMonthlySection[];
  model: string;
  error: string;
  /** 已生成模块数（running 时逐模块推进，前端可显示进度与部分章节）。 */
  progress: number;
  total: number;
}

export interface SentimentLatestMonthlyReportState extends SentimentMonthlyReportState {
  found: boolean;
  generatedAt?: string;
  from?: string;
  to?: string;
}

/** 读取已持久化的舆情报告（按任务 + 时间范围）。 */
export async function getLatestSentimentMonthlyReport(query: {
  from?: string;
  to?: string;
  taskId: number;
}): Promise<SentimentLatestMonthlyReportState> {
  return requestOperation("getLatestSentimentMonthlyReport", { query: compactQuery(query) });
}

/** 提交舆情报告生成（后台异步），返回 token。 */
export async function submitSentimentMonthlyReport(input: {
  from?: string;
  to?: string;
  taskId?: string;
  bucket?: "week" | "month";
}): Promise<{ token: string }> {
  return requestOperation("submitSentimentMonthlyReport", {
    body: compactBody({
      from: input.from,
      to: input.to,
      taskId: input.taskId,
      bucket: input.bucket,
    }),
  });
}

/** 轮询舆情报告生成状态与章节模块。 */
export async function getSentimentMonthlyReport(token: string): Promise<SentimentMonthlyReportState> {
  return requestOperation("getSentimentMonthlyReport", { parameters: { token } });
}

/** URL 种子回填：抓取人工发现的已知高价值文章落库（虎嗅/搜狐科技/亿邦/中关村等移动站直链）。 */
export async function backfillSentimentUrls(input: {
  urls: { url: string; channel?: string }[];
  mark?: boolean;
}): Promise<{ added: number; aiMarked: number }> {
  return requestOperation("backfillSentimentUrls", { body: input });
}

export async function getSentimentReport(query: {
  from?: string;
  to?: string;
  bucket?: "hour" | "day" | "week" | "month";
  taskId?: number;
}): Promise<SentimentReport> {
  return requestOperation("getSentimentReport", { query: compactQuery(query) });
}

/** 过滤未传的可选 query 键，避免 undefined 被序列化为 "undefined" 字符串。 */
function compactQuery(
  query: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined),
  );
}
