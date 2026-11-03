import MediaGrid from "./MediaGrid";
import type { DisplayProps } from "./types";

export default function VideoGallery(props: DisplayProps) {
  return (
    <MediaGrid
      events={props.events}
      complete={props.complete}
      include={(item) => item.kind === "video"}
      aspect="aspect-video"
      emptyText="No videos found in these results."
    />
  );
}
