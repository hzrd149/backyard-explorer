import mime from "mime";

interface GenericFilePreviewProps {
  url: string;
  mimeType?: string;
  fileExtension?: string;
  title?: string;
  size?: string;
}

export default function GenericFilePreview(props: GenericFilePreviewProps) {
  const getFileIcon = (mimeType?: string, fileExtension?: string) => {
    // Try to determine icon based on MIME type first
    if (mimeType) {
      if (mimeType.startsWith("image/")) {
        return (
          <svg
            class="w-8 h-8 text-green-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
              clip-rule="evenodd"
            />
          </svg>
        );
      }
      if (mimeType.startsWith("video/")) {
        return (
          <svg
            class="w-8 h-8 text-purple-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        );
      }
      if (mimeType.startsWith("audio/")) {
        return (
          <svg
            class="w-8 h-8 text-orange-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
              clip-rule="evenodd"
            />
          </svg>
        );
      }
    }

    // Fallback to file extension using mime package
    if (fileExtension) {
      const ext = fileExtension.toLowerCase();
      // Use mime package to get MIME type from extension for better detection
      const mimeTypeFromExt = mime.getType(ext);

      if (mimeTypeFromExt) {
        if (mimeTypeFromExt.startsWith("image/")) {
          return (
            <svg
              class="w-8 h-8 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clip-rule="evenodd"
              />
            </svg>
          );
        }
        if (mimeTypeFromExt.startsWith("video/")) {
          return (
            <svg
              class="w-8 h-8 text-purple-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          );
        }
        if (mimeTypeFromExt.startsWith("audio/")) {
          return (
            <svg
              class="w-8 h-8 text-orange-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                clip-rule="evenodd"
              />
            </svg>
          );
        }
      }

      // Fallback to hardcoded extension checks for common types
      if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
        return (
          <svg
            class="w-8 h-8 text-green-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
              clip-rule="evenodd"
            />
          </svg>
        );
      }
      if (["mp4", "avi", "mov", "webm", "mkv"].includes(ext)) {
        return (
          <svg
            class="w-8 h-8 text-purple-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        );
      }
      if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) {
        return (
          <svg
            class="w-8 h-8 text-orange-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
              clip-rule="evenodd"
            />
          </svg>
        );
      }
    }

    // Default file icon
    return (
      <svg
        class="w-8 h-8 text-gray-500"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fill-rule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
          clip-rule="evenodd"
        />
      </svg>
    );
  };

  return (
    <div class="bg-base-200 rounded-lg p-4">
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0">
          {getFileIcon(props.mimeType, props.fileExtension)}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-sm truncate">{props.title || "File"}</h4>
          <p class="text-xs text-base-content/50">
            {props.fileExtension && `${props.fileExtension} file`}
            {props.mimeType && ` • ${props.mimeType}`}
            {props.size && ` • ${props.size}`}
          </p>
        </div>
        <div class="flex-shrink-0">
          <a
            href={props.url}
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-primary btn-sm"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
