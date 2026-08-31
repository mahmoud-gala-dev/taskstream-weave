/** Curated, harmonious color library used for sections, tables, cells and items. */
export type PaletteColor = { name: string; value: string };

export const PALETTE: PaletteColor[] = [
  { name: "Slate", value: "#64748b" },
  { name: "Steel", value: "#475569" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Emerald", value: "#10b981" },
  { name: "Lime", value: "#84cc16" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Orange", value: "#f97316" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Pink", value: "#ec4899" },
];

/** Emoji icon set — no extra dependency, renders in every locale. */
export const ICONS: string[] = [
  "📌", "⭐", "🔥", "🎯", "🧠", "📝", "📚", "💡",
  "⚙️", "🐞", "🚀", "⏱️", "📈", "✅", "⚠️", "🔒",
  "📅", "📊", "🗂️", "🔍", "🧪", "🛠️", "💻", "🎨",
  "📞", "✉️", "💬", "🧾", "💰", "🏁", "🧩", "🔗",
  "🌱", "☕", "🌙", "❤️", "🏆", "🔔", "🚧", "❄️",
  "🎓", "🧭", "📦", "🖼️", "🎧", "🥇", "♻️", "🧯",
];

/** Translucent background derived from a palette color, safe on light and dark. */
export function tint(color?: string, alpha = 0.14): string | undefined {
  if (!color) return undefined;
  const hex = color.replace("#", "");
  if (hex.length !== 6) return undefined;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
