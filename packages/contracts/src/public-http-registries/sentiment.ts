import { objectSchema, operation, stringSchema } from "../public-http-schema";
import type { PublicHttpContract } from "../public-http-schema";

/** 舆情监测：情绪/话题/风险/渠道分布都是动态键的计数 Map（值类型固定为整数）。 */
const intMapSchema = { type: "object", additionalProperties: { type: "integer" } } as const;
const nullableStringSchema = { type: ["string", "null"] } as const;

/** 舆情条目（列表项）：时间/打标字段可空（未打标或渠道缺时间）。 */
const sentimentItemSchema = objectSchema(
  ["id", "channel", "title", "url"],
  {
    id: { type: "integer", minimum: 1 },
    channel: stringSchema,
    title: stringSchema,
    url: stringSchema,
    publishTime: nullableStringSchema,
    hitKeyword: nullableStringSchema,
    sentiment: nullableStringSchema,
    topic: nullableStringSchema,
    risk: nullableStringSchema,
    isSoftText: { type: ["integer", "null"] },
  },
);

const trendBucketSchema = objectSchema(
  ["period", "total", "positive", "neutral", "negative", "softText", "risk", "topKeywords"],
  {
    period: stringSchema,
    periodLabel: stringSchema,
    total: { type: "integer", minimum: 0 },
    positive: { type: "integer", minimum: 0 },
    neutral: { type: "integer", minimum: 0 },
    negative: { type: "integer", minimum: 0 },
    softText: { type: "integer", minimum: 0 },
    highRisk: { type: "integer", minimum: 0 },
    heatScore: { type: "number", minimum: 0 },
    risk: intMapSchema,
    topKeywords: {
      type: "array",
      items: objectSchema(["keyword", "count"], {
        keyword: stringSchema,
        count: { type: "integer", minimum: 0 },
      }),
    },
  },
);

const hotEventSchema = objectSchema(
  ["period", "periodLabel", "total", "heatScore", "changePct", "avgTotal", "topKeywords"],
  {
    period: stringSchema,
    periodLabel: stringSchema,
    total: { type: "integer", minimum: 0 },
    heatScore: { type: "number", minimum: 0 },
    changePct: { type: "number" },
    avgTotal: { type: "number", minimum: 0 },
    topKeywords: {
      type: "array",
      items: objectSchema(["keyword", "count"], {
        keyword: stringSchema,
        count: { type: "integer", minimum: 0 },
      }),
    },
  },
);

const keywordPerformanceSchema = objectSchema(
  ["keyword", "total", "positive", "neutral", "negative", "sentiment"],
  {
    keyword: stringSchema,
    total: { type: "integer", minimum: 0 },
    positive: { type: "integer", minimum: 0 },
    neutral: { type: "integer", minimum: 0 },
    negative: { type: "integer", minimum: 0 },
    sentiment: stringSchema,
  },
);

const wordCloudItemSchema = objectSchema(["word", "value", "negative"], {
  word: stringSchema,
  value: { type: "integer", minimum: 0 },
  negative: { type: "integer", minimum: 0 },
});

const hotTermSchema = objectSchema(["term", "count", "negative", "heatScore"], {
  term: stringSchema,
  count: { type: "integer", minimum: 0 },
  negative: { type: "integer", minimum: 0 },
  heatScore: { type: "number", minimum: 0 },
});

const relatedTermSchema = objectSchema(["term", "related"], {
  term: stringSchema,
  related: {
    type: "array",
    items: objectSchema(["word", "count"], {
      word: stringSchema,
      count: { type: "integer", minimum: 0 },
    }),
  },
});

/** report：周/月/日聚合报告数据。 */
const reportResponseSchema = objectSchema(
  [
    "from",
    "to",
    "bucket",
    "total",
    "softText",
    "sentiment",
    "risk",
    "topic",
    "channels",
    "trend",
    "keywordHits",
    "taskId",
    "taskName",
    "keywords",
    "items",
  ],
  {
    from: stringSchema,
    to: stringSchema,
    bucket: stringSchema,
    total: { type: "integer", minimum: 0 },
    softText: { type: "integer", minimum: 0 },
    sentiment: intMapSchema,
    risk: intMapSchema,
    topic: intMapSchema,
    channels: intMapSchema,
    trend: { type: "array", items: trendBucketSchema },
    keywordHits: { type: "array", items: keywordPerformanceSchema },
    hotEvents: { type: "array", items: hotEventSchema },
    wordCloud: { type: "array", items: wordCloudItemSchema },
    hotTerms: { type: "array", items: hotTermSchema },
    relatedTerms: { type: "array", items: relatedTermSchema },
    taskId: { type: ["integer", "null"] },
    taskName: stringSchema,
    keywords: { type: "array", items: stringSchema },
    items: { type: "array", items: sentimentItemSchema },
  },
);

/** 舆情监测：按采集任务关键词抓取/打标/聚合报告。 */
export const sentimentHttpContracts = {
  /** 打标未打标存量条目（规则版）；可传 taskId 使用任务监测词。 */
  markSentiment: operation(
    "POST",
    "/api/admin/sentiment/mark",
    200,
    { querystring: objectSchema([], { taskId: { type: "integer", minimum: 1 } }) },
    objectSchema(["marked"], { marked: { type: "integer", minimum: 0 } }),
  ),
  /** AI 打标：对未 AI 打标的条目调用启用模型识别命中关键词/情绪/软文/话题/风险并生成摘要。 */
  aiMarkSentiment: operation(
    "POST",
    "/api/admin/sentiment/ai-mark",
    200,
    {
      querystring: objectSchema([], {
        limit: { type: "integer", minimum: 1 },
        taskId: { type: "integer", minimum: 1 },
      }),
    },
    objectSchema(["marked"], { marked: { type: "integer", minimum: 0 } }),
  ),
  /** URL 种子回填：抓取人工发现的已知高价值文章落库（突破渠道搜索限制）。 */
  backfillSentimentUrls: operation(
    "POST",
    "/api/admin/sentiment/backfill",
    200,
    {
      body: objectSchema(["urls"], {
        urls: {
          type: "array",
          items: objectSchema([], {
            url: stringSchema,
            channel: stringSchema,
          }),
        },
        mark: { type: "boolean" },
      }),
    },
    objectSchema(["added", "aiMarked"], {
      added: { type: "integer", minimum: 0 },
      aiMarked: { type: "integer", minimum: 0 },
    }),
  ),
  /** 读取已持久化的舆情报告（按任务 + 时间范围）；不存在时 found=false。 */
  getLatestSentimentMonthlyReport: operation(
    "GET",
    "/api/admin/sentiment/monthly-report/latest",
    200,
    {
      query: objectSchema(["taskId"], {
        from: stringSchema,
        to: stringSchema,
        taskId: { type: "integer" },
      }),
    },
    objectSchema(["found", "status", "sections", "model", "error", "progress", "total"], {
      found: { type: "boolean" },
      status: { type: "string", enum: ["missing", "running", "done", "error"] },
      sections: {
        type: "array",
        items: objectSchema(["key", "title", "content"], {
          key: stringSchema,
          title: stringSchema,
          content: stringSchema,
        }),
      },
      model: stringSchema,
      error: stringSchema,
      progress: { type: "integer", minimum: 0 },
      total: { type: "integer", minimum: 0 },
      generatedAt: stringSchema,
      from: stringSchema,
      to: stringSchema,
    }),
  ),
  /** 提交舆情报告生成（后台异步），返回 token。 */
  submitSentimentMonthlyReport: operation(
    "POST",
    "/api/admin/sentiment/monthly-report",
    200,
    {
      body: objectSchema([], {
        from: stringSchema,
        to: stringSchema,
        taskId: stringSchema,
        bucket: { type: "string", enum: ["week", "month"] },
      }),
    },
    objectSchema(["token"], { token: stringSchema }),
  ),
  /** 轮询舆情报告生成状态与章节模块（status: running|done|error）。 */
  getSentimentMonthlyReport: operation(
    "GET",
    "/api/admin/sentiment/monthly-report/:token",
    200,
    { params: objectSchema(["token"], { token: stringSchema }) },
    objectSchema(["status", "sections", "model", "error", "progress", "total"], {
      status: { type: "string", enum: ["running", "done", "error"] },
      sections: {
        type: "array",
        items: objectSchema(["key", "title", "content"], {
          key: stringSchema,
          title: stringSchema,
          content: stringSchema,
        }),
      },
      model: stringSchema,
      error: stringSchema,
      progress: { type: "integer", minimum: 0 },
      total: { type: "integer", minimum: 0 },
    }),
  ),
  /** 周/月聚合报告数据（情绪占比与趋势/话题/风险/关键词表现/渠道来源）；taskId 指定采集任务。 */
  getSentimentReport: operation(
    "GET",
    "/api/admin/sentiment/report",
    200,
    {
      querystring: objectSchema([], {
        from: stringSchema,
        to: stringSchema,
        bucket: stringSchema,
        taskId: { type: "integer", minimum: 1 },
      }),
    },
    reportResponseSchema,
  ),
} satisfies Record<string, PublicHttpContract>;
