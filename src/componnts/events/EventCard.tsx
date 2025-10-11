import type { NostrEvent } from "nostr-tools";
import ProfileCard from "./ProfileCard";
import NoteCard from "./NoteCard";
import ContactListCard from "./ContactListCard";
import MetadataCard from "./MetadataCard";
import ArticleCard from "./ArticleCard";
import FileMetadataCard from "./FileMetadataCard";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";

interface EventCardProps {
  event: NostrEvent;
}

export default function EventCard(props: EventCardProps) {
  const renderEvent = () => {
    switch (props.event.kind) {
      case 0:
        return <ProfileCard profile={props.event} />;
      case 1:
        return <NoteCard note={props.event} />;
      case 3:
        return <ContactListCard contactList={props.event} />;
      case 10002:
        return <MetadataCard metadata={props.event} />;
      case 30023:
        return <ArticleCard article={props.event} />;
      case 1063:
        return <FileMetadataCard fileMetadata={props.event} />;
      default:
        return <GenericEventCard event={props.event} />;
    }
  };

  return renderEvent();
}

// Generic fallback for unknown event kinds
function GenericEventCard({ event }: { event: NostrEvent }) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        <div class="flex items-start gap-3">
          <UserAvatar pubkey={event.pubkey} size="sm" />
          <div class="flex-1 min-w-0 overflow-hidden">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <UserName
                  pubkey={event.pubkey}
                  showPubkey={false}
                  maxLength={15}
                  class="font-medium"
                />
                <div class="badge badge-outline text-xs">
                  Event Kind {event.kind}
                </div>
              </div>
              <span class="text-xs text-base-content/50">
                {formatDate(event.created_at)}
              </span>
            </div>
            <p class="text-base-content/70 text-sm mb-2">
              {event.content || "No content"}
            </p>
            <div class="flex items-center gap-4 text-xs text-base-content/50">
              <span>ID: {event.id.slice(0, 12)}...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
