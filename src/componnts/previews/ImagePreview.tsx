interface ImagePreviewProps {
  url: string;
  alt?: string;
  dimensions?: string;
}

export default function ImagePreview(props: ImagePreviewProps) {
  return (
    <img
      src={props.url}
      alt={props.alt || "Image preview"}
      class="rounded-lg max-h-[80vh]"
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
