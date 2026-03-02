import type { NostrEvent } from "nostr-tools";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import Hashtag from "../Hashtag";
import RichContent from "../RichContent.tsx";

interface NoteCardProps {
  note: NostrEvent;
}

export default function NoteCard(props: NoteCardProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        <div class="flex items-start gap-3">
          <UserAvatar pubkey={props.note.pubkey} size="sm" />
          <div class="flex-1 min-w-0 overflow-hidden">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <UserName
                  pubkey={props.note.pubkey}
                  showPubkey={false}
                  maxLength={15}
                  class="font-medium"
                />
                <div class="badge badge-outline text-xs">Note</div>
              </div>
              <span class="text-xs text-base-content/50">
                {formatDate(props.note.created_at)}
              </span>
            </div>

            <RichContent
              content={props.note.content}
              pubkey={props.note.pubkey}
            />

            {props.note.tags && props.note.tags.length > 0 && (
              <div class="flex flex-wrap gap-1 mt-3">
                {props.note.tags
                  .filter((tag) => tag[0] === "t" && tag[1])
                  .slice(0, 5)
                  .map((tag) => (
                    <Hashtag tag={tag[1]} />
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
