import { getFirebase } from "./firebase";
import type { Base } from "./types";

export const COL = {
  sections: "sections",
  tables: "tables",
  rows: "rows",
  columns: "columns",
  cells: "cells",
  items: "items",
  placements: "placements",
  subtasks: "subtasks",
  notes: "notes",
  pageNotes: "pageNotes",
  pageHighlights: "pageHighlights",
  links: "links",
  attachments: "attachments",
  workSessions: "workSessions",
  activityLogs: "activityLogs",
  settings: "settings",

} as const;

export type CollectionName = (typeof COL)[keyof typeof COL];

type WithoutBase<T> = Omit<T, "id" | "userId" | "createdAt" | "updatedAt">;

/**
 * Creates a user-owned document.
 * Side effects: one Firestore write. Errors: permission-denied when unauthenticated.
 */
export async function createRecord<T extends Base>(
  name: CollectionName,
  userId: string,
  data: WithoutBase<T>,
): Promise<string> {
  const { db } = await getFirebase();
  const { collection, addDoc } = await import("firebase/firestore");
  const now = Date.now();
  const ref = await addDoc(collection(db, name), {
    ...data,
    userId,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

/** Patches a document the current user owns. One Firestore write. */
export async function updateRecord<T extends Base>(
  name: CollectionName,
  id: string,
  data: Partial<WithoutBase<T>>,
): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, name, id), { ...data, updatedAt: Date.now() });
}

/** Deletes a single document. */
export async function deleteRecord(name: CollectionName, id: string): Promise<void> {
  const { db } = await getFirebase();
  const { doc, deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(db, name, id));
}

/** Atomically deletes many documents (batched in chunks of 400). */
export async function deleteMany(entries: Array<[CollectionName, string]>): Promise<void> {
  if (!entries.length) return;
  const { db } = await getFirebase();
  const { doc, writeBatch } = await import("firebase/firestore");
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    for (const [name, id] of entries.slice(i, i + 400)) batch.delete(doc(db, name, id));
    await batch.commit();
  }
}

/** Atomically applies many patches — used by reorder / AI apply operations. */
export async function updateMany(
  entries: Array<[CollectionName, string, Record<string, unknown>]>,
): Promise<void> {
  if (!entries.length) return;
  const { db } = await getFirebase();
  const { doc, writeBatch } = await import("firebase/firestore");
  const now = Date.now();
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    for (const [name, id, data] of entries.slice(i, i + 400)) {
      batch.update(doc(db, name, id), { ...data, updatedAt: now });
    }
    await batch.commit();
  }
}

/**
 * Realtime listener over one collection scoped to `userId`.
 * Returns an unsubscribe function. Ordering is done client-side to avoid
 * requiring composite indexes for every view.
 */
export async function watchUserCollection<T>(
  name: CollectionName,
  userId: string,
  cb: (rows: T[]) => void,
  onError?: (e: unknown) => void,
): Promise<() => void> {
  const { db } = await getFirebase();
  const { collection, onSnapshot, query, where } = await import("firebase/firestore");
  return onSnapshot(
    query(collection(db, name), where("userId", "==", userId)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
    (err) => onError?.(err),
  );
}

export async function logActivity(userId: string, action: string, detail?: string, itemId?: string) {
  try {
    await createRecord(COL.activityLogs, userId, {
      action,
      ...(detail !== undefined && { detail }),
      ...(itemId !== undefined && { itemId }),
    } as never);
  } catch {
    /* activity logging must never block the user */
  }
}
