import { toJpeg } from "html-to-image";

/** Snapshot kept in the browser so it can be pasted into any cell note. */
const KEY = "work-os:table-snapshot";

/** Firestore documents must stay small, so snapshots are compressed and capped. */
const MAX_BYTES = 600_000;

export async function captureElement(el: HTMLElement): Promise<string> {
  const style = getComputedStyle(document.body);
  // Google Fonts stylesheets are cross-origin: inlining them throws and the
  // capture silently produced nothing, so fonts are skipped on purpose.
  const dataUrl = await toJpeg(el, {
    quality: 0.72,
    pixelRatio: 1,
    backgroundColor: style.backgroundColor || "#ffffff",
    skipFonts: true,
    cacheBust: true,
  });
  if (!dataUrl || dataUrl.length < 1000) throw new Error("snapshot-empty");
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
