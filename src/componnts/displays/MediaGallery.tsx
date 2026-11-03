import MediaGrid from "./MediaGrid";
import type { DisplayProps } from "./types";

export default function MediaGallery(props: DisplayProps) {
  return (
    <MediaGrid
      events={props.events}
      include={() => true}
      emptyText="No images or videos found in these results."
    />
  );
}
