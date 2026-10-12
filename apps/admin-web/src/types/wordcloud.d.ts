declare module "wordcloud" {
  type WordCloudOptions = {
    list: [string, number][];
    gridSize?: number;
    weightFactor?: number | ((size: number) => number);
    fontFamily?: string;
    fontWeight?: string | number;
    color?: string | ((word: string, weight: number, fontSize: number, distance: number, theta: number) => string);
    rotateRatio?: number;
    rotationSteps?: number;
    minRotation?: number;
    maxRotation?: number;
    shuffle?: boolean;
    backgroundColor?: string;
    drawOutOfBound?: boolean;
    clearCanvas?: boolean;
  };

  export default function WordCloud(canvas: HTMLCanvasElement, options: WordCloudOptions): void;
}
