interface ImagePreviewProps {
  url: string;
  alt?: string;
  dimensions?: string;
}

export default function ImagePreview(props: ImagePreviewProps) {
  return (
    <div class="relative">
      <img
        src={props.url}
        alt={props.alt || "Image preview"}
        class="w-full h-48 object-cover rounded-lg"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}
