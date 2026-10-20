/// <reference lib="webworker" />
import { encodeCanvas, runPipeline, type ImageOp, type OutputSpec } from "./pipeline";

interface Job {
  id: number;
  bitmap: ImageBitmap;
  ops: ImageOp[];
  output: OutputSpec;
}

self.onmessage = async (e: MessageEvent<Job>) => {
  const { id, bitmap, ops, output } = e.data;
  try {
    const canvas = runPipeline(bitmap, ops, (w, h) => new OffscreenCanvas(w, h));
    bitmap.close();
    const blob = await encodeCanvas(canvas, output);
    (self as unknown as Worker).postMessage({ id, ok: true, blob, width: canvas.width, height: canvas.height });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
