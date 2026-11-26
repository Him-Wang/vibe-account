/**
 * 本地抠图：BiRefNet-lite（MIT）在浏览器里跑，图片不上传。
 * 首次使用会下载 ONNX 模型（约 94MB，之后走浏览器缓存）。
 *
 * 进度来自 transformers.js v4 的 `progress_total`（所有文件的聚合进度）；
 * 只听 per-file 的 `progress` 会一直显示 0%。下载卡住时有超时兜底，
 * 并依次尝试镜像与官方源，不会再无限停在 0%。
 */
import { createDeadline, makeModelProgress } from "./modelProgress";

type Segmenter = (input: unknown) => Promise<unknown>;

type EnvLike = { remoteHost?: string };

let segmenterPromise: Promise<Segmenter> | null = null;

async function loadSegmenter(
  onProgress?: (ratio: number) => void,
  onPhase?: (phase: string) => void
): Promise<Segmenter> {
  const mod = await import("@huggingface/transformers");
  const env = mod.env as EnvLike;

  let lastError: unknown;
  // Keep the original dtype (fp16). Letting the library pick its default
  // device (wasm) is the known-working path; forcing webgpu would break
  // browsers without WebGPU because v4 has no automatic fallback.
  for (const host of ["https://hf-mirror.com", "https://huggingface.co"]) {
    const deadline = createDeadline(180_000, "抠图模型下载超时，检查网络后再试一次");
    const progress = makeModelProgress({ onProgress, onPhase });
    try {
      env.remoteHost = host;
      const pipelinePromise = mod.pipeline("background-removal", "studioludens/birefnet-lite-512", {
        dtype: "fp16",
        progress_callback: (info) => {
          progress(info);
          deadline.kick();
        },
      });
      // Avoid an unhandled rejection when the deadline wins the race.
      pipelinePromise.catch(() => undefined);
      const loaded = (await Promise.race([pipelinePromise, deadline.promise])) as Segmenter;
      deadline.cancel();
      onProgress?.(1);
      return loaded;
    } catch (err) {
      deadline.cancel();
      lastError = err;
      // Try the next mirror. A timed-out download may still finish in the
      // background, which is harmless: the cached files just help next time.
    }
  }
  throw lastError instanceof Error ? lastError : new Error("抠图模型没加载下来");
}

function getSegmenter(
  onProgress?: (ratio: number) => void,
  onPhase?: (phase: string) => void
): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = loadSegmenter(onProgress, onPhase).catch((err) => {
      segmenterPromise = null;
      throw err;
    });
  }
  return segmenterPromise;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function cutoutProduct(
  image: string,
  onProgress?: (ratio: number) => void,
  onPhase?: (phase: string) => void
): Promise<string> {
  const segmenter = await getSegmenter(onProgress, onPhase);
  onPhase?.("正在把背景去掉…");
  onProgress?.(1);
  const output = await segmenter(image);
  const list = Array.isArray(output) ? output : [output];
  const first = list[0] as
    | { toBlob?: () => Promise<Blob>; blob?: Blob; toDataURL?: (type?: string) => string }
    | undefined;
  if (first) {
    if (typeof first.toBlob === "function") {
      return readBlobAsDataUrl(await first.toBlob());
    }
    if (first.blob instanceof Blob) {
      return readBlobAsDataUrl(first.blob);
    }
    if (typeof first.toDataURL === "function") {
      return first.toDataURL("image/png");
    }
  }
  throw new Error("抠图结果格式不支持");
}
