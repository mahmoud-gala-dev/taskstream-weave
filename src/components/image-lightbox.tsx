import { useEffect, useState, useRef, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Trash2,
  X,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type ImageLightboxProps = {
  src: string | null;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void;
  title?: string;
};

export function ImageLightbox({
  src,
  alt = "Image preview",
  isOpen,
  onClose,
  onDelete,
  title,
}: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPan = useRef({ x: 0, y: 0 });

  const resetTransform = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetTransform();
    }
  }, [isOpen, resetTransform, src]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(5, Math.round((z + 0.25) * 100) / 100));
      } else if (e.key === "-" || e.key === "_") {
        setZoom((z) => Math.max(0.25, Math.round((z - 0.25) * 100) / 100));
      } else if (e.key === "0" || e.key.toLowerCase() === "r") {
        resetTransform();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, resetTransform]);

  if (!isOpen || !src) return null;

  const handleZoomIn = () => {
    setZoom((z) => Math.min(5, Math.round((z + 0.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.25, Math.round((z - 0.25) * 100) / 100));
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = title || "image-download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom((z) => Math.min(5, Math.max(0.25, Math.round((z + delta) * 100) / 100)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialPan.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({
      x: initialPan.current.x + dx,
      y: initialPan.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (zoom === 1) {
      setZoom(2.2);
    } else {
      resetTransform();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || alt}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/85 backdrop-blur-md select-none transition-all"
      onClick={onClose}
    >
      {/* Top Floating Controls Bar */}
      <div
        className="relative z-10 mt-4 flex flex-wrap items-center gap-2 rounded-full border border-border/40 bg-card/80 px-4 py-2 shadow-2xl backdrop-blur-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <span className="max-w-[200px] truncate text-xs font-medium text-muted-foreground px-2">
            {title}
          </span>
        ) : null}

        {/* Zoom Out */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-full text-foreground hover:bg-accent"
          onClick={handleZoomOut}
          title="Zoom Out (-)"
        >
          <ZoomOut className="size-4" />
        </Button>

        {/* Zoom Level Indicator */}
        <button
          type="button"
          onClick={resetTransform}
          className="rounded-full bg-accent/60 px-2.5 py-0.5 text-xs font-mono font-medium hover:bg-accent transition"
          title="Click to reset (100%)"
        >
          {Math.round(zoom * 100)}%
        </button>

        {/* Zoom In */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-full text-foreground hover:bg-accent"
          onClick={handleZoomIn}
          title="Zoom In (+)"
        >
          <ZoomIn className="size-4" />
        </Button>

        <div className="h-4 w-px bg-border/60 mx-1" />

        {/* Reset */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-full text-foreground hover:bg-accent"
          onClick={resetTransform}
          title="Reset View (R)"
        >
          <Maximize2 className="size-4" />
        </Button>

        {/* Rotate */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-full text-foreground hover:bg-accent"
          onClick={handleRotate}
          title="Rotate 90°"
        >
          <RotateCw className="size-4" />
        </Button>

        {/* Download */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-full text-foreground hover:bg-accent"
          onClick={handleDownload}
          title="Download Image"
        >
          <Download className="size-4" />
        </Button>

        {/* Delete (if provided) */}
        {onDelete ? (
          <>
            <div className="h-4 w-px bg-border/60 mx-1" />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 rounded-full text-destructive hover:bg-destructive/15"
              onClick={() => {
                onDelete();
                onClose();
              }}
              title="Delete Image"
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        ) : null}

        <div className="h-4 w-px bg-border/60 mx-1" />

        {/* Close Button */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-full text-foreground hover:bg-accent hover:text-destructive"
          onClick={onClose}
          title="Close (Esc)"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Main Image Canvas Area */}
      <div
        className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl pointer-events-none"
        />
      </div>

      {/* Bottom Hint */}
      <div
        className="relative z-10 mb-4 rounded-full border border-border/30 bg-card/60 px-4 py-1 text-[11px] text-muted-foreground shadow backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <span>عجلة الفأرة للتكبير/التصغير · اسحب للتحريك · نقر مزدوج للتبديل · Esc للإغلاق</span>
      </div>
    </div>
  );
}
