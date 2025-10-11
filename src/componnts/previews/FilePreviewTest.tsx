import type { NostrEvent } from "nostr-tools";
import FileMetadataCard from "../events/FileMetadataCard";

// Sample file metadata events for testing different preview types
export const sampleFileMetadataEvents: NostrEvent[] = [
  // Image file
  {
    id: "sample-image-id-1",
    pubkey: "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc",
    created_at: Math.floor(Date.now() / 1000) - 3600,
    kind: 1063,
    tags: [
      ["url", "https://example.com/sample-image.jpg"],
      ["m", "image/jpeg"],
      ["x", "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"],
      ["size", "2048576"],
      ["dim", "1920x1080"],
      ["alt", "A beautiful landscape photo"],
      ["summary", "Scenic mountain view at sunset"],
    ],
    content:
      "Check out this amazing landscape photo I took during my hiking trip!",
    sig: "sample-signature-1",
  },

  // Video file
  {
    id: "sample-video-id-1",
    pubkey: "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc",
    created_at: Math.floor(Date.now() / 1000) - 7200,
    kind: 1063,
    tags: [
      ["url", "https://example.com/sample-video.mp4"],
      ["m", "video/mp4"],
      [
        "x",
        "b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890",
      ],
      ["size", "52428800"],
      ["dim", "1280x720"],
      ["thumb", "https://example.com/video-thumbnail.jpg"],
      ["alt", "Tutorial video about Nostr development"],
    ],
    content: "Here's a tutorial video I made about building Nostr applications",
    sig: "sample-signature-2",
  },

  // Audio file
  {
    id: "sample-audio-id-1",
    pubkey: "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc",
    created_at: Math.floor(Date.now() / 1000) - 10800,
    kind: 1063,
    tags: [
      ["url", "https://example.com/podcast-episode.mp3"],
      ["m", "audio/mp3"],
      [
        "x",
        "c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890ab",
      ],
      ["size", "15728640"],
      ["summary", "Episode 42: The Future of Decentralized Social Media"],
    ],
    content:
      "New podcast episode is live! We discuss the latest developments in decentralized social media.",
    sig: "sample-signature-3",
  },

  // PDF document
  {
    id: "sample-pdf-id-1",
    pubkey: "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc",
    created_at: Math.floor(Date.now() / 1000) - 14400,
    kind: 1063,
    tags: [
      ["url", "https://example.com/research-paper.pdf"],
      ["m", "application/pdf"],
      [
        "x",
        "d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890abcd",
      ],
      ["size", "1048576"],
      ["summary", "Research paper on Nostr protocol improvements"],
    ],
    content:
      "Just published my latest research paper on Nostr protocol improvements. Check it out!",
    sig: "sample-signature-4",
  },

  // Text document
  {
    id: "sample-text-id-1",
    pubkey: "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc",
    created_at: Math.floor(Date.now() / 1000) - 18000,
    kind: 1063,
    tags: [
      ["url", "https://example.com/readme.txt"],
      ["m", "text/plain"],
      [
        "x",
        "e5f6789012345678901234567890abcdef1234567890abcdef1234567890abcdef",
      ],
      ["size", "2048"],
    ],
    content: "Project documentation and setup instructions",
    sig: "sample-signature-5",
  },

  // Archive file
  {
    id: "sample-archive-id-1",
    pubkey: "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc",
    created_at: Math.floor(Date.now() / 1000) - 21600,
    kind: 1063,
    tags: [
      ["url", "https://example.com/project-source.zip"],
      ["m", "application/zip"],
      [
        "x",
        "f6789012345678901234567890abcdef1234567890abcdef1234567890abcdef12",
      ],
      ["size", "5242880"],
    ],
    content: "Complete source code archive for the project",
    sig: "sample-signature-6",
  },

  // Generic file with magnet link
  {
    id: "sample-torrent-id-1",
    pubkey: "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc",
    created_at: Math.floor(Date.now() / 1000) - 25200,
    kind: 1063,
    tags: [
      ["url", "https://example.com/large-dataset.bin"],
      ["m", "application/octet-stream"],
      [
        "x",
        "7890123456789012345678901234567890abcdef1234567890abcdef1234567890",
      ],
      ["size", "1073741824"],
      [
        "magnet",
        "magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678",
      ],
      ["i", "1234567890abcdef1234567890abcdef12345678"],
    ],
    content:
      "Large dataset available for download. Use magnet link for better speeds.",
    sig: "sample-signature-7",
  },
];

// Test component to render sample file metadata events
export function FilePreviewTest() {
  return (
    <div class="space-y-4 p-4">
      <h2 class="text-2xl font-bold mb-4">File Preview Components Test</h2>
      <p class="text-base-content/70 mb-6">
        This demonstrates all the different file preview components for kind
        1063 file metadata events.
      </p>
      {sampleFileMetadataEvents.map((event) => (
        <FileMetadataCard key={event.id} fileMetadata={event} />
      ))}
    </div>
  );
}
