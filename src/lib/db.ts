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

const LOCAL_STORAGE_PREFIX = "work-os:local-db:";

export function isGuestId(userId: string): boolean {
  return userId.startsWith("guest_") || userId === "guest";
}

function getLocalKey(name: CollectionName): string {
  return `${LOCAL_STORAGE_PREFIX}${name}`;
}

function readLocalCollection<T extends Base>(name: CollectionName): T[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(getLocalKey(name));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalCollection<T extends Base>(name: CollectionName, rows: T[]) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(getLocalKey(name), JSON.stringify(rows));
  } catch {
    /* storage is best-effort */
  }
}

type Listener<T> = (rows: T[]) => void;
const localListeners = new Map<string, Set<Listener<never>>>();

function getListenerKey(name: CollectionName, userId: string): string {
  return `${name}:${userId}`;
}

function notifyLocalListeners(name: CollectionName, userId?: string) {
  if (userId) {
    const key = getListenerKey(name, userId);
    const set = localListeners.get(key);
    if (set && set.size > 0) {
      const rows = readLocalCollection(name).filter((r) => r.userId === userId);
      set.forEach((cb) => {
        try {
          cb(rows as never);
        } catch {
          /* listener error */
        }
      });
    }
  } else {
    // Notify all listeners for this collection
    localListeners.forEach((set, key) => {
      if (key.startsWith(`${name}:`)) {
        const uId = key.slice(name.length + 1);
        const rows = readLocalCollection(name).filter((r) => r.userId === uId);
        set.forEach((cb) => {
          try {
            cb(rows as never);
          } catch {
            /* listener error */
          }
        });
      }
    });
  }
}

function generateLocalId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a user-owned document.
 * In guest mode or offline, saves to localStorage with reactive notification.
 */
export async function createRecord<T extends Base>(
  name: CollectionName,
  userId: string,
  data: WithoutBase<T>,
): Promise<string> {
  const now = Date.now();
  if (isGuestId(userId)) {
    const id = generateLocalId();
    const rows = readLocalCollection<T>(name);
    const newDoc = {
      ...data,
      id,
      userId,
      createdAt: now,
      updatedAt: now,
    } as unknown as T;
    rows.push(newDoc);
    writeLocalCollection(name, rows);
    notifyLocalListeners(name, userId);
    return id;
  }

  try {
    const { db } = await getFirebase();
    const { collection, addDoc } = await import("firebase/firestore");
    const ref = await addDoc(collection(db, name), {
      ...data,
      userId,
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  } catch (err) {
    // Fallback to local storage if Firestore connection fails
    const id = generateLocalId();
    const rows = readLocalCollection<T>(name);
    const newDoc = {
      ...data,
      id,
      userId,
      createdAt: now,
      updatedAt: now,
    } as unknown as T;
    rows.push(newDoc);
    writeLocalCollection(name, rows);
    notifyLocalListeners(name, userId);
    return id;
  }
}

/** Patches a document the current user owns. */
export async function updateRecord<T extends Base>(
  name: CollectionName,
  id: string,
  data: Partial<WithoutBase<T>>,
): Promise<void> {
  const now = Date.now();
  const localRows = readLocalCollection<T>(name);
  const localIndex = localRows.findIndex((r) => r.id === id);

  if (localIndex >= 0 || id.startsWith("local_") || id.startsWith("guest_")) {
    if (localIndex >= 0) {
      const existing = localRows[localIndex];
      const updated = {
        ...existing,
        ...data,
        updatedAt: now,
      };
      localRows[localIndex] = updated as T;
      writeLocalCollection(name, localRows);
      notifyLocalListeners(name, existing.userId);
    }
    return;
  }

  try {
    const { db } = await getFirebase();
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, name, id), { ...data, updatedAt: now });
  } catch {
    // If not in firestore, check local rows
    if (localIndex >= 0) {
      const existing = localRows[localIndex];
      localRows[localIndex] = { ...existing, ...data, updatedAt: now } as T;
      writeLocalCollection(name, localRows);
      notifyLocalListeners(name, existing.userId);
    }
  }
}

/** Deletes a single document. */
export async function deleteRecord(name: CollectionName, id: string): Promise<void> {
  const localRows = readLocalCollection(name);
  const localIndex = localRows.findIndex((r) => r.id === id);

  if (localIndex >= 0 || id.startsWith("local_") || id.startsWith("guest_")) {
    if (localIndex >= 0) {
      const [removed] = localRows.splice(localIndex, 1);
      writeLocalCollection(name, localRows);
      notifyLocalListeners(name, removed.userId);
    }
    return;
  }

  try {
    const { db } = await getFirebase();
    const { doc, deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, name, id));
  } catch {
    if (localIndex >= 0) {
      const [removed] = localRows.splice(localIndex, 1);
      writeLocalCollection(name, localRows);
      notifyLocalListeners(name, removed.userId);
    }
  }
}

/** Atomically deletes many documents. */
export async function deleteMany(entries: Array<[CollectionName, string]>): Promise<void> {
  if (!entries.length) return;

  const localEntries: Array<[CollectionName, string]> = [];
  const remoteEntries: Array<[CollectionName, string]> = [];

  for (const [name, id] of entries) {
    if (id.startsWith("local_") || id.startsWith("guest_") || readLocalCollection(name).some((r) => r.id === id)) {
      localEntries.push([name, id]);
    } else {
      remoteEntries.push([name, id]);
    }
  }

  if (localEntries.length > 0) {
    const touchedCollections = new Set<CollectionName>();
    for (const [name, id] of localEntries) {
      const rows = readLocalCollection(name);
      const next = rows.filter((r) => r.id !== id);
      if (next.length !== rows.length) {
        writeLocalCollection(name, next);
        touchedCollections.add(name);
      }
    }
    touchedCollections.forEach((c) => notifyLocalListeners(c));
  }

  if (remoteEntries.length > 0) {
    try {
      const { db } = await getFirebase();
      const { doc, writeBatch } = await import("firebase/firestore");
      for (let i = 0; i < remoteEntries.length; i += 400) {
        const batch = writeBatch(db);
        for (const [name, id] of remoteEntries.slice(i, i + 400)) batch.delete(doc(db, name, id));
        await batch.commit();
      }
    } catch {
      /* ignore remote error */
    }
  }
}

/** Atomically applies many patches — used by reorder / AI apply operations. */
export async function updateMany(
  entries: Array<[CollectionName, string, Record<string, unknown>]>,
): Promise<void> {
  if (!entries.length) return;

  const now = Date.now();
  const localEntries: Array<[CollectionName, string, Record<string, unknown>]> = [];
  const remoteEntries: Array<[CollectionName, string, Record<string, unknown>]> = [];

  for (const [name, id, data] of entries) {
    if (id.startsWith("local_") || id.startsWith("guest_") || readLocalCollection(name).some((r) => r.id === id)) {
      localEntries.push([name, id, data]);
    } else {
      remoteEntries.push([name, id, data]);
    }
  }

  if (localEntries.length > 0) {
    const touchedCollections = new Set<CollectionName>();
    for (const [name, id, data] of localEntries) {
      const rows = readLocalCollection(name);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...data, updatedAt: now };
        writeLocalCollection(name, rows);
        touchedCollections.add(name);
      }
    }
    touchedCollections.forEach((c) => notifyLocalListeners(c));
  }

  if (remoteEntries.length > 0) {
    try {
      const { db } = await getFirebase();
      const { doc, writeBatch } = await import("firebase/firestore");
      for (let i = 0; i < remoteEntries.length; i += 400) {
        const batch = writeBatch(db);
        for (const [name, id, data] of remoteEntries.slice(i, i + 400)) {
          batch.update(doc(db, name, id), { ...data, updatedAt: now });
        }
        await batch.commit();
      }
    } catch {
      /* ignore remote batch error */
    }
  }
}

/**
 * Realtime listener over one collection scoped to `userId`.
 * Returns an unsubscribe function.
 */
export async function watchUserCollection<T>(
  name: CollectionName,
  userId: string,
  cb: (rows: T[]) => void,
  onError?: (e: unknown) => void,
): Promise<() => void> {
  if (isGuestId(userId)) {
    const key = getListenerKey(name, userId);
    if (!localListeners.has(key)) {
      localListeners.set(key, new Set());
    }
    const set = localListeners.get(key)!;
    const listener = cb as unknown as Listener<never>;
    set.add(listener);

    // Provide initial state immediately
    const initialRows = readLocalCollection<Base>(name).filter((r) => r.userId === userId) as unknown as T[];
    setTimeout(() => {
      try {
        cb(initialRows);
      } catch {
        /* listener error */
      }
    }, 0);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        localListeners.delete(key);
      }
    };
  }

  try {
    const { db } = await getFirebase();
    const { collection, onSnapshot, query, where } = await import("firebase/firestore");
    return onSnapshot(
      query(collection(db, name), where("userId", "==", userId)),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
      (err) => {
        // If Firestore fails, fall back to local store
        const fallbackRows = readLocalCollection<Base>(name).filter((r) => r.userId === userId) as unknown as T[];
        cb(fallbackRows);
        onError?.(err);
      },
    );
  } catch (err) {
    const fallbackRows = readLocalCollection<Base>(name).filter((r) => r.userId === userId) as unknown as T[];
    cb(fallbackRows);
    return () => {};
  }
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

