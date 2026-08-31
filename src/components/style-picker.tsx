import { Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ICONS, PALETTE } from "@/lib/palette";
import { cn } from "@/lib/utils";

/**
 * Color + icon chooser used by cells, rows, columns and item cards.
 * Purely presentational: the caller persists the chosen values.
 */
export function StylePicker({
  color,
  icon,
  onChange,
  label = "Color and icon",
  className,
}: {
  color?: string | undefined;
  icon?: string | undefined;
  onChange: (patch: { color?: string | null; icon?: string | null }) => void;
  label?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className={className}>
          {icon ? (
            <span aria-hidden>{icon}</span>
          ) : (
            <Palette className="size-4" style={color ? { color } : undefined} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Color</p>
          <div className="grid grid-cols-6 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={c.name}
                title={c.name}
                onClick={() => onChange({ color: c.value })}
                className={cn(
                  "size-6 rounded-full border border-border/60 transition-transform hover:scale-110",
                  color === c.value && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Icon</p>
          <div className="grid grid-cols-8 gap-1">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Icon ${i}`}
                onClick={() => onChange({ icon: i })}
                className={cn(
                  "rounded-md p-1 text-base hover:bg-muted",
                  icon === i && "bg-primary/15 ring-1 ring-primary",
                )}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange({ color: null, icon: null })}
        >
          Clear style
        </Button>
      </PopoverContent>
    </Popover>
  );
}
