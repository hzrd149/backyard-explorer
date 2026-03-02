interface ImagePreviewProps {
  url: string;
  alt?: string;
  dimensions?: string;
}

export default function ImagePreview(props: ImagePreviewProps) {
  return (
    <a href={props.url} target="_blank" rel="noopener noreferrer">
      <img
        src={props.url}
        alt={props.alt || "Image preview"}
        class="rounded-lg max-h-[80vh]"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.parentElement!.style.display = "none";
        }}
      />
    </a>
  );
}
