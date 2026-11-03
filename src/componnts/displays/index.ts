import type { Component } from "solid-js";
import type { DisplayMode } from "../../services/DisplayService";
import type { DisplayProps } from "./types";
import TimelineDisplay from "./TimelineDisplay";
import ImageGallery from "./ImageGallery";
import VideoGallery from "./VideoGallery";
import MediaGallery from "./MediaGallery";
import TorrentDashboard from "./TorrentDashboard";
import ArticleGrid from "./ArticleGrid";
import HighlightWall from "./HighlightWall";
import CodeBrowser from "./CodeBrowser";
import ProfileDirectory from "./ProfileDirectory";
import RawInspector from "./RawInspector";
import ThreadsDisplay from "./ThreadsDisplay";
import CalendarDisplay from "./CalendarDisplay";
import MarketDisplay from "./MarketDisplay";
import MapDisplay from "./MapDisplay";
import StatsDashboard from "./StatsDashboard";

/** The component that renders each display mode */
export const DISPLAY_COMPONENTS: Record<
  DisplayMode,
  Component<DisplayProps>
> = {
  timeline: TimelineDisplay,
  images: ImageGallery,
  videos: VideoGallery,
  media: MediaGallery,
  torrents: TorrentDashboard,
  articles: ArticleGrid,
  highlights: HighlightWall,
  code: CodeBrowser,
  profiles: ProfileDirectory,
  threads: ThreadsDisplay,
  calendar: CalendarDisplay,
  market: MarketDisplay,
  map: MapDisplay,
  stats: StatsDashboard,
  raw: RawInspector,
};

/** Modes that read best in a narrow column; the rest use the full width */
export const NARROW_MODES: DisplayMode[] = [
  "timeline",
  "code",
  "raw",
  "threads",
  "calendar",
];

export type { DisplayProps };
