interface AudioPreviewProps {
  url: string;
  title?: string;
  duration?: string;
}

export default function AudioPreview(props: AudioPreviewProps) {
  return (
    <div class="bg-base-200 rounded-lg p-4">
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0">
          <div class="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
            <svg
              class="w-6 h-6 text-primary-content"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-sm truncate">
            {props.title || "Audio File"}
          </h4>
          {props.duration && (
            <p class="text-xs text-base-content/50">{props.duration}</p>
          )}
        </div>
        <audio controls class="flex-shrink-0">
          <source src={props.url} type="audio/mpeg" />
          <source src={props.url} type="audio/wav" />
          <source src={props.url} type="audio/ogg" />
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  );
}
