/**
 * 本地抠图：BiRefNet-lite（MIT）在浏览器里跑，图片不上传。
 * 首次使用会从镜像下载约 100MB 的 ONNX 模型，之后走浏览器缓存。
 * 本地打包的 MODNet / RMBG 与此版 Transformers.js 的 background-removal
 * 管线不兼容，先保留远程 BiRefNet，功能优先。
 */
let segmenterPromise: Promise<(input: unknown) => Promise<unknown>> | null = null;

async function getSegmenter(onProgress?: (ratio: number) => void) {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
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

function rawToDataUrl(raw: unknown): string {
  const value = raw as { toDataURL?: (type?: string) => string };
  if (typeof value?.toDataURL === "function") return value.toDataURL("image/png");
  throw new Error("抠图结果格式不支持");
}

export async function cutoutProduct(
  image: string,
  onProgress?: (ratio: number) => void
): Promise<string> {
  const segmenter = await getSegmenter(onProgress);
  const output = await segmenter(image);
  const list = Array.isArray(output) ? output : [output];
  const first = list[0] as { toBlob?: () => Promise<Blob>; blob?: Blob } | undefined;
  if (first) {
    if (typeof first.toBlob === "function") {
      const blob = await first.toBlob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }
    const blob = first.blob;
    if (blob instanceof Blob) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }
  }
  return rawToDataUrl(output);
}
