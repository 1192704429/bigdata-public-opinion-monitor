import type { SentimentWordCloudItem } from "@aicp/api-client/admin";
import { Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import WordCloud from "wordcloud";

import "./word-cloud.css";

const { Text } = Typography;

const PALETTE = ["#1a4f8f", "#2563eb", "#3b82c4", "#0f766e", "#4f46a5", "#0369a1", "#2f6db5"];

type WordCloudCanvasProps = {
  data: SentimentWordCloudItem[];
  height?: number;
};

function isNegativeHeavy(item: SentimentWordCloudItem): boolean {
  return item.negative > 0 && item.negative >= item.value / 2;
}

export function WordCloudCanvas({ data, height = 320 }: WordCloudCanvasProps): React.ReactNode {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect.width ?? wrap.clientWidth);
      if (next > 0) setWidth(next);
    });
    observer.observe(wrap);
    setWidth(Math.floor(wrap.clientWidth));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || data.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...data.map((item) => item.value), 1);
    const negativeWords = new Set(data.filter(isNegativeHeavy).map((item) => item.word));
    const colorMap = new Map(data.map((item, index) => [item.word, index]));

    WordCloud(canvas, {
      list: data.map((item) => [item.word, item.value]),
      gridSize: Math.max(6, Math.round(10 * (width / 640))),
      weightFactor: (size) => Math.max(16, (size / max) * 56),
      fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontWeight: "500",
      color: (word) => {
        const key = String(word);
        if (negativeWords.has(key)) return "#b42318";
        const index = colorMap.get(key) ?? 0;
        return PALETTE[index % PALETTE.length];
      },
      rotateRatio: 0.4,
      rotationSteps: 2,
      minRotation: -Math.PI / 6,
      maxRotation: Math.PI / 6,
      shuffle: false,
      backgroundColor: "transparent",
      drawOutOfBound: false,
      clearCanvas: true,
    });
  }, [data, height, width]);

  if (data.length === 0) {
    return (
      <div className="sentiment-word-cloud sentiment-word-cloud--empty" style={{ height }}>
        <Text type="secondary">暂无词云数据</Text>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="sentiment-word-cloud" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label="热点词云" />
    </div>
  );
}
