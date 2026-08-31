import { Circle, Download, File, FileAudio, FileText, Grid2X2, List, Maximize2, Pause, Play, Square, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { MarkdownPreview, isMarkdown } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { confirmToast } from "@/lib/confirm";
import { useScreenRecorder } from "@/hooks/useScreenRecorder";
import { useT } from "@/lib/i18n";
import { formatDuration } from "@/lib/sessions";
import { deleteAttachment, isLocalAttachment, resolveAttachmentUrl, uploadAttachment } from "@/lib/storage";
import type { Attachment, ItemType } from "@/lib/types";

/**
 * Screenshots, recordings and files for one item. Paste (Ctrl+V) an image while
 * this panel is mounted to attach it. Binaries live in Firebase Storage; only
 * metadata is written to Firestore.
 */
export function ItemDocumentation({
  userId,
  item,
  attachments,
}: {
  userId: string | null;
  item: { id: string; type: ItemType };
  attachments: Attachment[];
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string | null>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: Blob, filename: string, kind: Attachment["kind"]) => {
      if (!userId) return;
      setBusy(true);
      try {
        await uploadAttachment(userId, item, file, { filename, kind });
        toast.success(t("item.files.attached"));
      } catch (e) {
        toast.error(t("item.files.uploadFailed"), { description: e instanceof Error ? e.message : undefined });
      } finally {
        setBusy(false);
      }
    },
    [userId, item, t],
  );

  const recorder = useScreenRecorder((blob) =>
    upload(blob, `recording-${new Date().toISOString().slice(0, 19)}.webm`, "video"),
  );

  const uploadFiles = useCallback((files: File[]) => {
    for (const file of files) {
      void upload(file, file.name, file.type.startsWith("image/") ? "screenshot" : file.type.startsWith("video/") ? "video" : "file");
    }
  }, [upload]);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (!file) return;
      e.preventDefault();
      void upload(file, file.name || `screenshot-${Date.now()}.png`, "screenshot");
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [upload]);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    void Promise.all(
      attachments.map(async (attachment) => {
        const url = await resolveAttachmentUrl(attachment);
        if (url?.startsWith("blob:")) objectUrls.push(url);
        return [attachment.id, url] as const;
      }),
    ).then((entries) => {
      if (active) setResolvedUrls(Object.fromEntries(entries));
    });
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [attachments]);

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold">{t("item.files.title")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("item.files.hint")}
      </p>

      <div
        className={"mt-3 rounded-lg border border-dashed p-4 transition-colors " + (dragging ? "border-primary bg-primary/10" : "border-border")}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(Array.from(e.dataTransfer.files)); }}
      >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" /> {t("item.files.upload")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          aria-label={t("item.files.uploadAria")}
          multiple
          accept="image/*,video/*,audio/*,application/pdf,.md,.markdown,text/markdown,.txt"
          onChange={(e) => {
            uploadFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {recorder.status === "idle" || recorder.status === "processing" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={recorder.status === "processing"}
            onClick={() => void recorder.start()}
          >
            <Circle className="size-4 text-destructive" />
            {recorder.status === "processing" ? t("item.files.uploading") : t("item.files.recordScreen")}
          </Button>
        ) : (
          <>
            <span className="font-mono text-sm" dir="ltr">
              {formatDuration(recorder.seconds)}
            </span>
            {recorder.status === "recording" ? (
              <Button variant="outline" size="sm" onClick={recorder.pause}>
                <Pause className="size-4" /> {t("item.files.pause")}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={recorder.resume}>
                <Play className="size-4" /> {t("item.files.resume")}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={recorder.stop}>
              <Square className="size-4" /> {t("item.files.stop")}
            </Button>
          </>
        )}
      </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">{t("item.files.dropHint")}</p>
      </div>
      {recorder.error ? <p className="mt-2 text-sm text-destructive">{recorder.error}</p> : null}

      <div className="mt-4 flex justify-end gap-1">
        <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" aria-label={t("item.files.gridView")} onClick={() => setView("grid")}><Grid2X2 className="size-4" /></Button>
        <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" aria-label={t("item.files.listView")} onClick={() => setView("list")}><List className="size-4" /></Button>
      </div>
      <ul className={view === "grid" ? "mt-2 grid gap-3 sm:grid-cols-2" : "mt-2 space-y-2"}>
        {attachments.map((a) => {
          const mediaUrl = resolvedUrls[a.id] ?? (isLocalAttachment(a) ? "" : a.downloadURL);
          return (
          <li key={a.id} className={view === "grid" ? "rounded-lg border border-border p-2" : "flex items-center gap-3 rounded-md border border-border p-2"}>
            {a.kind === "screenshot" && mediaUrl ? (
              <button type="button" onClick={() => setPreview(a)} className={view === "list" ? "size-12 shrink-0 overflow-hidden rounded" : "block w-full"}><img
                src={mediaUrl}
                alt={a.filename}
                loading="lazy"
                className="max-h-48 w-full rounded-md object-contain"
              /></button>
            ) : a.kind === "video" && mediaUrl ? (
              view === "grid" ? <video src={mediaUrl} controls playsInline preload="metadata" className="w-full rounded-md" /> : <File className="size-8 shrink-0 text-muted-foreground" />
            ) : a.mimeType === "application/pdf" || isMarkdown(a.mimeType, a.filename) ? <FileText className="size-8 shrink-0 text-muted-foreground" /> : a.mimeType.startsWith("audio/") ? <FileAudio className="size-8 shrink-0 text-muted-foreground" /> : <File className="size-8 shrink-0 text-muted-foreground" />}
            <div className={(view === "grid" ? "mt-2 " : "") + "flex min-w-0 flex-1 items-center gap-2"}>
              {mediaUrl ? <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="min-w-0 flex-1 truncate text-xs text-primary hover:underline"
              >
                {a.filename}
              </a> : <span className="min-w-0 flex-1 truncate text-xs text-destructive">{t("item.files.localMissing")}</span>}
              {isLocalAttachment(a) ? <span className="text-xs text-muted-foreground">{t("item.files.localOnly")}</span> : null}
              {mediaUrl && (a.kind === "screenshot" || a.kind === "video" || a.mimeType === "application/pdf" || isMarkdown(a.mimeType, a.filename) || a.mimeType.startsWith("audio/")) ? <Button variant="ghost" size="icon" aria-label={t("item.files.preview", { filename: a.filename })} onClick={() => setPreview(a)}><Maximize2 className="size-4" /></Button> : null}
              {mediaUrl ? <Button asChild variant="ghost" size="icon"><a href={mediaUrl} download={a.filename} aria-label={t("item.files.download", { filename: a.filename })}><Download className="size-4" /></a></Button> : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("item.files.delete", { filename: a.filename })}
                onClick={() => {
                  void confirmToast(t("item.files.confirmDelete", { filename: a.filename }), {
                    confirmLabel: t("common.delete"),
                    cancelLabel: t("common.cancel"),
                  }).then(
                    (ok) =>
                      ok && void deleteAttachment(a).then(() => toast.success(t("item.files.deleted"))),
                  );
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
          );
        })}
      </ul>
      {preview && resolvedUrls[preview.id] ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-6" role="dialog" aria-modal="true" aria-label={t("item.files.previewDialog", { filename: preview.filename })} onClick={() => setPreview(null)}><div className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>{preview.kind === "screenshot" ? <img src={resolvedUrls[preview.id] ?? ""} alt={preview.filename} className="max-h-[80vh] max-w-full object-contain" /> : preview.kind === "video" ? <video src={resolvedUrls[preview.id] ?? ""} controls autoPlay playsInline preload="metadata" className="max-h-[80vh] max-w-full" /> : isMarkdown(preview.mimeType, preview.filename) ? <MarkdownPreview url={resolvedUrls[preview.id] ?? ""} label={preview.filename} /> : preview.mimeType.startsWith("audio/") ? <audio src={resolvedUrls[preview.id] ?? ""} controls autoPlay preload="metadata" /> : <iframe src={resolvedUrls[preview.id] ?? ""} title={preview.filename} className="h-[80vh] w-[min(90vw,900px)] bg-card" /> }<Button className="mt-3 w-full" variant="outline" onClick={() => setPreview(null)}>{t("item.files.closePreview")}</Button></div></div> : null}
    </section>
  );
}
