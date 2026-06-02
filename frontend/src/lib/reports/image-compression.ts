/**
 * Client-side image preprocessing for report attachments.
 *
 * Goal: reduce bandwidth + storage for the "1日300件" workload by compressing
 * before upload. HEIC (common from iOS) is converted to JPEG first because
 * browsers can't natively decode it; everything else is normalised to WebP
 * with quality 0.8 at 1600px long-edge.
 *
 * The Blob upload endpoint accepts image/jpeg, image/png, image/webp, image/heic
 * (10MB max). After this helper:
 *   - HEIC input -> WebP output (filename .webp)
 *   - JPEG/PNG/WebP input -> WebP output, downscaled if needed
 *
 * If anything fails (decode error, unsupported in browser), we fall back to
 * the original file so the user can still submit.
 */

const MAX_LONG_EDGE = 1600;
const QUALITY = 0.8;

export type CompressedImage = {
  file: File;
  originalBytes: number;
  finalBytes: number;
};

function withExt(name: string, ext: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${ext}`;
}

function isHeic(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "image/heic" || t === "image/heif") return true;
  const n = file.name.toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif");
}

async function heicToJpeg(file: File): Promise<File> {
  // heic2any is browser-only and pulls in libheif; lazy-import so SSR builds
  // don't try to evaluate it.
  const heic2any = (await import("heic2any")).default;
  const blob = (await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  })) as Blob;
  return new File([blob], withExt(file.name, "jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export async function compressReportImage(input: File): Promise<CompressedImage> {
  const originalBytes = input.size;
  try {
    let working = input;
    if (isHeic(working)) {
      working = await heicToJpeg(working);
    }

    const { default: imageCompression } = await import("browser-image-compression");
    const compressed = await imageCompression(working, {
      maxSizeMB: 2,
      maxWidthOrHeight: MAX_LONG_EDGE,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: QUALITY,
    });

    // browser-image-compression returns a Blob-like; ensure it's a File with a sane name.
    const out =
      compressed instanceof File
        ? new File([compressed], withExt(working.name, "webp"), {
            type: "image/webp",
            lastModified: Date.now(),
          })
        : new File([compressed], withExt(working.name, "webp"), {
            type: "image/webp",
            lastModified: Date.now(),
          });

    // If compression somehow made it bigger (tiny inputs, already-optimal),
    // keep whichever is smaller — unless the original was HEIC, in which case
    // we must use the converted output since the server doesn't accept HEIC
    // bytes through the WebP path either way.
    if (!isHeic(input) && out.size >= originalBytes) {
      return { file: input, originalBytes, finalBytes: input.size };
    }
    return { file: out, originalBytes, finalBytes: out.size };
  } catch (err) {
    console.error("[image-compression] falling back to original:", err);
    return { file: input, originalBytes, finalBytes: input.size };
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
