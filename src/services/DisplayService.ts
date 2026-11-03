import type { QueryPlan } from "./QueryPlanner";

/** The parts of a query plan that pick a display mode */
export type DisplayQuery = Pick<QueryPlan, "kinds" | "mimeTypes" | "view">;

/** Ways a set of search results can be rendered. Never affects the filter. */
export type DisplayMode =
  | "timeline"
  | "images"
  | "videos"
  | "media"
  | "torrents"
  | "articles"
  | "highlights"
  | "code"
  | "profiles"
  | "threads"
  | "calendar"
  | "market"
  | "map"
  | "stats"
  | "raw";

export interface DisplayModeInfo {
  id: DisplayMode;
  label: string;
  icon: string;
  aliases: string[];
  /** Event kinds that select this mode by default when they make up the whole query */
  kinds?: number[];
  /**
   * The view's page doesn't grow with its results (a map, a summary), so the end of the
   * list never scrolls away. It loads a bounded batch at a time instead of scrolling.
   */
  bounded?: boolean;
}

export const IMAGE_KINDS = [20];
export const VIDEO_KINDS = [21, 22, 34235, 34236];
/** Forum threads, comments, chat, live chat, public messages and channel messages */
export const THREAD_KINDS = [11, 1111, 9, 1311, 24, 42];
/** Calendar events (NIP-52) and live events, rooms and conferences (NIP-53) */
export const CALENDAR_KINDS = [31922, 31923, 30311, 30312, 30313];
/** Classified listings (NIP-99) and marketplace products (NIP-15) */
export const MARKET_KINDS = [30402, 30403, 30018];

export const DISPLAY_MODES: DisplayModeInfo[] = [
  { id: "timeline", label: "Timeline", icon: "📰", aliases: ["notes", "feed"] },
  {
    id: "images",
    label: "Images",
    icon: "🖼️",
    aliases: ["gallery", "image"],
    kinds: IMAGE_KINDS,
  },
  {
    id: "videos",
    label: "Videos",
    icon: "🎬",
    aliases: ["video"],
    kinds: VIDEO_KINDS,
  },
  { id: "media", label: "Media", icon: "🎞️", aliases: [] },
  {
    id: "torrents",
    label: "Torrents",
    icon: "🧲",
    aliases: ["torrent"],
    kinds: [2003],
  },
  {
    id: "articles",
    label: "Articles",
    icon: "📖",
    aliases: ["reader", "longform", "article"],
    kinds: [30023, 30818],
  },
  {
    id: "highlights",
    label: "Highlights",
    icon: "🖍️",
    aliases: ["quotes", "highlight"],
    kinds: [9802],
  },
  {
    id: "code",
    label: "Code",
    icon: "💻",
    aliases: ["snippets", "snippet"],
    kinds: [1337],
  },
  {
    id: "profiles",
    label: "Profiles",
    icon: "👥",
    aliases: ["people", "directory", "profile"],
    kinds: [0],
  },
  {
    id: "threads",
    label: "Threads",
    icon: "💬",
    aliases: ["thread", "conversations", "discussion", "chat"],
    kinds: THREAD_KINDS,
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "📅",
    aliases: ["agenda", "schedule"],
    kinds: CALENDAR_KINDS,
  },
  {
    id: "market",
    label: "Market",
    icon: "🛒",
    aliases: ["shop", "listings", "classifieds"],
    kinds: MARKET_KINDS,
  },
  {
    id: "map",
    label: "Map",
    icon: "🗺️",
    aliases: ["geo", "places"],
    kinds: [37516, 7516],
    bounded: true,
  },
  {
    id: "stats",
    label: "Stats",
    icon: "📊",
    aliases: ["insights", "analytics", "summary"],
    bounded: true,
  },
  { id: "raw", label: "Raw", icon: "🧾", aliases: ["json", "inspector"] },
];

/** Resolve a `view:` value (id or alias) to a display mode */
export function normalizeDisplayMode(input?: string): DisplayMode | undefined {
  if (!input) return undefined;
  const value = input.toLowerCase();
  return DISPLAY_MODES.find((m) => m.id === value || m.aliases.includes(value))
    ?.id;
}

export function getDisplayModeInfo(mode: DisplayMode): DisplayModeInfo {
  return DISPLAY_MODES.find((m) => m.id === mode)!;
}

/** Pick the default display mode for a query from its kinds and MIME types */
export function defaultDisplayMode(parsed: DisplayQuery): DisplayMode {
  const kinds = parsed.kinds;

  if (kinds.length > 0) {
    const modes = new Set(
      kinds.map(
        (kind) => DISPLAY_MODES.find((m) => m.kinds?.includes(kind))?.id,
      ),
    );
    if (modes.size === 1) {
      const [mode] = modes;
      if (mode) return mode;
    }

    // A mix of image and video kinds
    if (kinds.every((k) => IMAGE_KINDS.includes(k) || VIDEO_KINDS.includes(k)))
      return "media";
  }

  // MIME type filters on kind-less (or file metadata) queries
  const mimes = parsed.mimeTypes;
  if (mimes.length > 0 && kinds.every((k) => k === 1063)) {
    const images = mimes.every((m) => m.startsWith("image/"));
    const videos = mimes.every((m) => m.startsWith("video/"));
    if (images) return "images";
    if (videos) return "videos";
    if (mimes.every((m) => m.startsWith("image/") || m.startsWith("video/")))
      return "media";
  }

  return "timeline";
}

export interface ResolvedDisplayMode {
  mode: DisplayMode;
  /** True when the user chose the mode with `view:` */
  explicit: boolean;
  /** The unrecognized `view:` value, if any */
  invalid?: string;
}

/** An explicit `view:` wins, otherwise fall back to the query's default */
export function resolveDisplayMode(parsed: DisplayQuery): ResolvedDisplayMode {
  const explicit = normalizeDisplayMode(parsed.view);
  if (explicit) return { mode: explicit, explicit: true };
  return {
    mode: defaultDisplayMode(parsed),
    explicit: false,
    invalid: parsed.view,
  };
}

const VIEW_PREFIXES = ["view:", "display:", "v:"];

/** Remove any `view:` token from a query string */
export function stripViewTokens(query: string): string {
  return query
    .split(/\s+/)
    .filter((token) => !VIEW_PREFIXES.some((p) => token.startsWith(p)))
    .join(" ")
    .trim();
}
