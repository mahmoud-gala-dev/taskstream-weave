import { toJpeg } from "html-to-image";

/** Snapshot kept in the browser so it can be pasted into any cell note. */
const KEY = "work-os:table-snapshot";

/** Firestore documents must stay small, so snapshots are compressed and capped. */
const MAX_BYTES = 600_000;

export async function captureElement(el: HTMLElement): Promise<string> {
  const style = getComputedStyle(document.body);
  return toJpeg(el, {
    quality: 0.72,
    pixelRatio: 1,
    backgroundColor: style.backgroundColor || "#ffffff",
    cacheBust: true,
  });
}

export function snapshotTooLarge(dataUrl: string): boolean {
  return dataUrl.length > MAX_BYTES;
}

export function saveSnapshot(dataUrl: string) {
  try {
    window.localStorage.setItem(KEY, dataUrl);
  } catch {
    /* storage may be full — snapshot is best effort */
  }
}

export function readSnapshot(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
