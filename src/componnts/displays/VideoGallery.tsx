import MediaGrid from "./MediaGrid";
import type { DisplayProps } from "./types";

export default function VideoGallery(props: DisplayProps) {
  return (
    <MediaGrid
      events={props.events}
      include={(item) => item.kind === "video"}
      inlineVideo
      aspect="aspect-video"
      emptyText="No videos found in these results."
    />
  );
}
