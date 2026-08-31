import { toJpeg } from "html-to-image";

/** Snapshot kept in the browser so it can be pasted into any cell note. */
const KEY = "work-os:table-snapshot";

/** Firestore documents must stay small, so snapshots are compressed and capped. */
const MAX_BYTES = 600_000;

/** Re-encodes a data URL through a canvas at a smaller scale / quality. */
async function shrink(dataUrl: string, scale: number, quality: number): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("snapshot-decode"));
    img.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Captures an element as a JPEG data URL and keeps shrinking it until it fits
 * the note budget, so a wide table still produces a usable image instead of
 * failing with "snapshot too large".
 */
export async function captureElement(el: HTMLElement): Promise<string> {
  const style = getComputedStyle(document.body);
  // Google Fonts stylesheets are cross-origin: inlining them throws and the
  // capture silently produced nothing, so fonts are skipped on purpose.
  let dataUrl = await toJpeg(el, {
    quality: 0.72,
    pixelRatio: 1,
    backgroundColor: style.backgroundColor || "#ffffff",
    skipFonts: true,
    cacheBust: true,
  });
  if (!dataUrl || dataUrl.length < 1000) throw new Error("snapshot-empty");

  for (const [scale, quality] of [
    [0.85, 0.6],
    [0.7, 0.5],
    [0.55, 0.45],
    [0.4, 0.4],
  ] as const) {
    if (dataUrl.length <= MAX_BYTES) break;
    try {
      dataUrl = await shrink(dataUrl, scale, quality);
    } catch {
      break;
    }
  }
  return dataUrl;
}

export function snapshotTooLarge(dataUrl: string): boolean {
  return dataUrl.length > MAX_BYTES;
}

/** In-memory copy so a full localStorage never loses the pending snapshot. */
let memorySnapshot: string | null = null;

export function saveSnapshot(dataUrl: string): boolean {
  memorySnapshot = dataUrl;
  try {
    window.localStorage.setItem(KEY, dataUrl);
    return true;
  } catch {
    return false;
  }
}

export function readSnapshot(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memorySnapshot;
  } catch {
    return memorySnapshot;
  }
}
