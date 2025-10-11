interface VideoPreviewProps {
  url: string;
  thumbnail?: string;
  previewImage?: string;
  alt?: string;
}

export default function VideoPreview(props: VideoPreviewProps) {
  return (
    <div class="relative">
      <video
        src={props.url}
        controls
        class="w-full h-48 object-cover rounded-lg"
        poster={props.thumbnail || props.previewImage}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
