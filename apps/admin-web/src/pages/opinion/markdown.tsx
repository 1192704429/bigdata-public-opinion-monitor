import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import "./opinion-markdown.css";

/** 舆情报告正文 Markdown 渲染（GFM：标题/列表/表格/加粗等）。 */
export function MarkdownText({
  content,
  tenantSlug: _tenantSlug,
}: {
  content: string;
  tenantSlug: string;
}): ReactNode {
  return (
    <div className="opinion-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
