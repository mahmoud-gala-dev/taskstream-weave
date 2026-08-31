import { COL, createRecord, deleteRecord, logActivity } from "@/lib/db";
import { getFirebase, trackEvent } from "@/lib/firebase";
import type { Attachment, ItemType } from "@/lib/types";

/** Firestore documents are capped at 1 MB; base64 adds roughly 33% overhead. */
const INLINE_LIMIT = 500 * 1024;
const LOCAL_PREFIX = "indexeddb:";
const LOCAL_DB = "work-os-attachments";
const LOCAL_STORE = "blobs";

function openLocalAttachmentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LOCAL_STORE)) {
        request.result.createObjectStore(LOCAL_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local file storage."));
  });
}

async function writeLocalBlob(key: string, blob: Blob): Promise<void> {
  const db = await openLocalAttachmentDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readwrite");
    tx.objectStore(LOCAL_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the file on this device."));
  });
  db.close();
}

async function readLocalBlob(key: string): Promise<Blob | null> {
  const db = await openLocalAttachmentDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction(LOCAL_STORE, "readonly").objectStore(LOCAL_STORE).get(key);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not read the local file."));
  });
  db.close();
  return blob ?? null;
}

async function deleteLocalBlob(key: string): Promise<void> {
  const db = await openLocalAttachmentDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readwrite");
    tx.objectStore(LOCAL_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not delete the local file."));
  });
  db.close();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(blob);
  });
}

function storageErrorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error ? String(error.code) : "";
}

/**
 * Uploads a file to Firebase Storage under users/{uid}/items/{itemType}/{itemId}/
 * and stores only metadata in Firestore.
 *
 * If the Storage bucket is unavailable, small files fall back to an inline
 * Firestore data URL and larger files/videos are persisted in IndexedDB on the
 * current device. The latter remains usable after reload without pretending it
 * has been cloud-synced.
 */
export async function uploadAttachment(
  userId: string,
  item: { id: string; type: ItemType },
  file: Blob,
  options: { filename: string; kind: Attachment["kind"]; mimeType?: string },
): Promise<string> {
  const { auth, storage } = await getFirebase();
  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");

  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    throw new Error("Your sign-in session is not ready. Sign in again before uploading.");
  }

  const contentType = options.mimeType ?? file.type ?? "application/octet-stream";
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `users/${userId}/items/${item.type}/${item.id}/${fileId}-${options.filename}`;

  let downloadURL = "";
  let savedPath = storagePath;
  try {
    const objectRef = ref(storage, storagePath);
    await uploadBytes(objectRef, file, { contentType });
    downloadURL = await getDownloadURL(objectRef);
  } catch (error) {
    const code = storageErrorCode(error);
    const recoverable =
      code === "" ||
      code === "storage/unknown" ||
      code === "storage/unauthorized" ||
      code === "storage/retry-limit-exceeded" ||
      code === "storage/bucket-not-found" ||
      code === "storage/project-not-found";
    if (!recoverable) throw error;
    if (file.size > INLINE_LIMIT) {
      await writeLocalBlob(fileId, file);
      savedPath = `${LOCAL_PREFIX}${fileId}`;
    } else {
      downloadURL = await blobToDataUrl(file);
      savedPath = "";
    }
  }

  const id = await createRecord<Attachment>(COL.attachments, userId, {
    itemId: item.id,
    storagePath: savedPath,
    downloadURL,
    filename: options.filename,
    mimeType: contentType,
    kind: options.kind,
    size: file.size,
  });
  void trackEvent(options.kind === "video" ? "video_recorded" : "attachment_uploaded");
  void logActivity(userId, "Added attachment", options.filename, item.id);
  return id;
}

/** Resolves cloud/inline URLs and creates a temporary object URL for local files. */
export async function resolveAttachmentUrl(attachment: Attachment): Promise<string | null> {
  if (!attachment.storagePath.startsWith(LOCAL_PREFIX)) return attachment.downloadURL || null;
  const blob = await readLocalBlob(attachment.storagePath.slice(LOCAL_PREFIX.length));
  return blob ? URL.createObjectURL(blob) : null;
}

export function isLocalAttachment(attachment: Attachment): boolean {
  return attachment.storagePath.startsWith(LOCAL_PREFIX);
}

/** Deletes both the Storage object and its Firestore metadata. */
export async function deleteAttachment(attachment: Attachment): Promise<void> {
  if (attachment.storagePath.startsWith(LOCAL_PREFIX)) {
    await deleteLocalBlob(attachment.storagePath.slice(LOCAL_PREFIX.length));
  } else if (attachment.storagePath) {
    try {
      const { storage } = await getFirebase();
      const { ref, deleteObject } = await import("firebase/storage");
      await deleteObject(ref(storage, attachment.storagePath));
    } catch {
      // Object already gone or inline — still remove the metadata.
    }
  }
  await deleteRecord(COL.attachments, attachment.id);
}
