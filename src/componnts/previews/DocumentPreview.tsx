import mime from "mime";

interface DocumentPreviewProps {
  url: string;
  mimeType: string;
  title?: string;
  size?: string;
}

export default function DocumentPreview(props: DocumentPreviewProps) {
  const getDocumentIcon = (mimeType: string) => {
    // Use mime package to get extension for better icon selection
    const extension = mime.getExtension(mimeType);

    if (extension) {
      if (extension === "pdf") {
        return (
          <svg
            class="w-8 h-8 text-red-500"
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
      }
      if (["txt", "md", "rtf"].includes(extension)) {
        return (
          <svg
            class="w-8 h-8 text-blue-500"
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
      }
      if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
        return (
          <svg
            class="w-8 h-8 text-yellow-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clip-rule="evenodd"
            />
          </svg>
        );
      }
    }

    // Fallback to MIME type string matching
    if (mimeType.includes("pdf")) {
      return (
        <svg
          class="w-8 h-8 text-red-500"
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
    }
    if (mimeType.includes("text")) {
      return (
        <svg
          class="w-8 h-8 text-blue-500"
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
    }
    if (mimeType.includes("zip") || mimeType.includes("archive")) {
      return (
        <svg
          class="w-8 h-8 text-yellow-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clip-rule="evenodd"
          />
        </svg>
      );
    }
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
        <div class="flex-shrink-0">{getDocumentIcon(props.mimeType)}</div>
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-sm truncate">
            {props.title || "Document"}
          </h4>
          <p class="text-xs text-base-content/50">
            {props.mimeType}
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
            Open
          </a>
        </div>
      </div>
    </div>
  );
}
