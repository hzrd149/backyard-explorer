import type { NostrEvent } from "nostr-tools";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import {
  ImagePreview,
  VideoPreview,
  AudioPreview,
  DocumentPreview,
  GenericFilePreview,
} from "../previews";
import {
  getFileMetadata,
  type FileMetadata,
} from "applesauce-core/helpers/file-metadata";
import mime from "mime";

interface FileMetadataCardProps {
  fileMetadata: NostrEvent;
}

export default function FileMetadataCard(props: FileMetadataCardProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Parse file metadata using applesauce-core helper
  const fileMetadata: FileMetadata = getFileMetadata(props.fileMetadata);

  // Determine if this is an image or video
  const isImage = fileMetadata.type?.startsWith("image/");
  const isVideo = fileMetadata.type?.startsWith("video/");
  const isAudio = fileMetadata.type?.startsWith("audio/");

  // Get file extension from URL or MIME type using mime package
  const getFileExtension = () => {
    // Try to get extension from URL first
    if (fileMetadata.url) {
      try {
        const urlPath = new URL(fileMetadata.url).pathname;
        const extension = urlPath.split(".").pop();
        if (extension && extension.length <= 5) {
          return extension.toUpperCase();
        }
      } catch (error) {
        // Invalid URL, fall back to MIME type
      }
    }

    // Use mime package to get extension from MIME type
    if (fileMetadata.type) {
      const extension = mime.getExtension(fileMetadata.type);
      if (extension) {
        return extension.toUpperCase();
      }
    }

    return "FILE";
  };

  const fileExtension = getFileExtension();

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        <div class="flex items-start gap-3">
          <UserAvatar pubkey={props.fileMetadata.pubkey} size="sm" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <UserName
                  pubkey={props.fileMetadata.pubkey}
                  showPubkey={false}
                  maxLength={15}
                  class="font-medium"
                />
                <div class="badge badge-outline text-xs">File</div>
                <div class="badge badge-secondary badge-xs">
                  {fileExtension}
                </div>
              </div>
              <span class="text-xs text-base-content/50">
                {formatDate(props.fileMetadata.created_at)}
              </span>
            </div>

            {/* File Preview */}
            {fileMetadata.url && (
              <div class="mb-3">
                {isImage ? (
                  <ImagePreview
                    url={fileMetadata.url}
                    alt={fileMetadata.alt || props.fileMetadata.content}
                    dimensions={fileMetadata.dimensions}
                  />
                ) : isVideo ? (
                  <VideoPreview
                    url={fileMetadata.url}
                    thumbnail={fileMetadata.thumbnail}
                    previewImage={fileMetadata.image}
                    alt={fileMetadata.alt || props.fileMetadata.content}
                  />
                ) : isAudio ? (
                  <AudioPreview
                    url={fileMetadata.url}
                    title={props.fileMetadata.content}
                  />
                ) : fileMetadata.type?.includes("application/pdf") ||
                  fileMetadata.type?.includes("text/") ||
                  fileMetadata.type?.includes("application/zip") ? (
                  <DocumentPreview
                    url={fileMetadata.url}
                    mimeType={fileMetadata.type}
                    title={props.fileMetadata.content}
                    size={
                      fileMetadata.size
                        ? formatFileSize(fileMetadata.size)
                        : undefined
                    }
                  />
                ) : (
                  <GenericFilePreview
                    url={fileMetadata.url}
                    mimeType={fileMetadata.type}
                    fileExtension={fileExtension}
                    title={props.fileMetadata.content}
                    size={
                      fileMetadata.size
                        ? formatFileSize(fileMetadata.size)
                        : undefined
                    }
                  />
                )}
              </div>
            )}

            {/* File Content Description */}
            {props.fileMetadata.content && (
              <p class="text-base-content/70 text-sm mb-3 line-clamp-3">
                {props.fileMetadata.content}
              </p>
            )}

            {/* Summary */}
            {fileMetadata.summary && (
              <p class="text-base-content/60 text-xs mb-3 italic">
                {fileMetadata.summary}
              </p>
            )}

            {/* File Details */}
            <div class="bg-base-200 rounded-lg p-3 mb-3">
              <div class="grid grid-cols-2 gap-2 text-xs">
                {fileMetadata.type && (
                  <div>
                    <span class="text-base-content/50">Type:</span>
                    <span class="ml-1 font-mono">{fileMetadata.type}</span>
                  </div>
                )}
                {fileMetadata.size && (
                  <div>
                    <span class="text-base-content/50">Size:</span>
                    <span class="ml-1">
                      {formatFileSize(fileMetadata.size)}
                    </span>
                  </div>
                )}
                {fileMetadata.dimensions && (
                  <div>
                    <span class="text-base-content/50">Dimensions:</span>
                    <span class="ml-1">{fileMetadata.dimensions}</span>
                  </div>
                )}
                {fileMetadata.sha256 && (
                  <div class="col-span-2">
                    <span class="text-base-content/50">Hash:</span>
                    <span class="ml-1 font-mono text-xs">
                      {fileMetadata.sha256.slice(0, 16)}...
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div class="flex gap-2">
              {fileMetadata.url && (
                <a
                  href={fileMetadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-primary btn-sm flex-1"
                >
                  {isImage
                    ? "View Image"
                    : isVideo
                      ? "Play Video"
                      : isAudio
                        ? "Play Audio"
                        : "Download"}
                </a>
              )}
              {fileMetadata.magnet && (
                <a
                  href={fileMetadata.magnet}
                  class="btn btn-outline btn-sm"
                  title="Download via Magnet Link"
                >
                  Magnet
                </a>
              )}
            </div>

            {/* Additional Info */}
            {(fileMetadata.originalSha256 || fileMetadata.infohash) && (
              <div class="mt-2 text-xs text-base-content/40">
                {fileMetadata.originalSha256 && (
                  <div>
                    Original: {fileMetadata.originalSha256.slice(0, 8)}...
                  </div>
                )}
                {fileMetadata.infohash && (
                  <div>Torrent: {fileMetadata.infohash.slice(0, 8)}...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
