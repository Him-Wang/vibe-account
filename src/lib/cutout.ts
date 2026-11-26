/**
 * 本地抠图：BiRefNet-lite（MIT）在浏览器里跑，不上传图片。
 * 首次使用会从镜像下载约 110MB 的 ONNX 模型，之后走缓存。
 */
let segmenterPromise: Promise<(input: unknown) => Promise<unknown>> | null = null;

async function getSegmenter(onProgress?: (ratio: number) => void) {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      // 国内直连 huggingface.co 经常失败；镜像不可用时再退回官方源。
      env.remoteHost = "https://hf-mirror.com";
      let lastError: unknown;
      for (const host of ["https://hf-mirror.com", "https://huggingface.co"]) {
        try {
          env.remoteHost = host;
          return (await pipeline("background-removal", "studioludens/birefnet-lite-512", {
            dtype: "fp16",
            progress_callback: (p: { status?: string; progress?: number }) => {
              if (p?.status === "progress" && typeof p.progress === "number") {
                onProgress?.(Math.max(0, Math.min(1, p.progress / 100)));
              }
            },
          })) as unknown as (input: unknown) => Promise<unknown>;
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("抠图模型没加载下来");
    })().catch((err) => {
      segmenterPromise = null;
      throw err;
    });
  }
  return segmenterPromise;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("抠图结果读不出来"));
    reader.readAsDataURL(blob);
  });
}

async function rawToDataUrl(raw: unknown): Promise<string> {
  const image = raw as { toCanvas?: () => HTMLCanvasElement | OffscreenCanvas };
  if (!image?.toCanvas) throw new Error("抠图结果不是图片");
  const canvas = image.toCanvas();
  if (typeof (canvas as HTMLCanvasElement).toDataURL === "function") {
    return (canvas as HTMLCanvasElement).toDataURL("image/png");
  }
  const offscreen = canvas as OffscreenCanvas;
  if (typeof offscreen.convertToBlob === "function") {
    return blobToDataUrl(await offscreen.convertToBlob({ type: "image/png" }));
  }
  throw new Error("这个浏览器不支持导出抠图结果");
}

export async function cutoutProduct(
  image: string,
  onProgress?: (ratio: number) => void
): Promise<string> {
  const segmenter = await getSegmenter(onProgress);
  const result = await segmenter(image);
  const raw = Array.isArray(result) ? result[0] : result;
  return rawToDataUrl(raw);
}
