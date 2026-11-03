import MediaGrid from "./MediaGrid";
import type { DisplayProps } from "./types";

export default function ImageGallery(props: DisplayProps) {
  return (
    <MediaGrid
      events={props.events}
      complete={props.complete}
      include={(item) => item.kind === "image"}
      emptyText="No images found in these results."
    />
  );
}
