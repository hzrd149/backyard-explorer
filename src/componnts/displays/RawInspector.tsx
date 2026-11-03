import { createSignal, For, Show } from "solid-js";
import { neventEncode } from "nostr-tools/nip19";
import UserName from "../UserName";
import CopyButton from "./CopyButton";
import type { DisplayProps } from "./types";

/** Developer view: compact event table with expandable raw JSON */
export default function RawInspector(props: DisplayProps) {
  const [open, setOpen] = createSignal<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allJson = () => JSON.stringify(props.events, null, 2);

  return (
    <div class="space-y-2">
      <div class="flex justify-end gap-2">
        <button
          class="btn btn-ghost btn-xs"
          onClick={() =>
            setOpen(
              open().size === props.events.length
                ? new Set<string>()
                : new Set(props.events.map((e) => e.id)),
            )
          }
        >
          {open().size === props.events.length ? "Collapse all" : "Expand all"}
        </button>
        <CopyButton
          value={allJson()}
          label="Copy all JSON"
          class="btn btn-outline btn-xs"
        />
      </div>
      <div class="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table class="table table-xs font-mono">
          <thead>
            <tr>
              <th>id</th>
              <th>kind</th>
              <th>author</th>
              <th class="hidden sm:table-cell">created_at</th>
              <th class="hidden md:table-cell">tags</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <For each={props.events}>
              {(event) => (
                <>
                  <tr
                    class="hover cursor-pointer"
                    onClick={() => toggle(event.id)}
                  >
                    <td>
                      {open().has(event.id) ? "▾ " : "▸ "}
                      {event.id.slice(0, 10)}
                    </td>
                    <td>{event.kind}</td>
                    <td>
                      <UserName pubkey={event.pubkey} maxLength={14} />
                    </td>
                    <td class="hidden sm:table-cell whitespace-nowrap">
                      {new Date(event.created_at * 1000).toISOString()}
                    </td>
                    <td class="hidden md:table-cell">{event.tags.length}</td>
                    <td
                      class="whitespace-nowrap text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CopyButton
                        value={JSON.stringify(event, null, 2)}
                        label="JSON"
                      />
                      <CopyButton
                        value={neventEncode({
                          id: event.id,
                          author: event.pubkey,
                          kind: event.kind,
                        })}
                        label="nevent"
                      />
                    </td>
                  </tr>
                  <Show when={open().has(event.id)}>
                    <tr>
                      <td colspan={6} class="bg-base-200 p-0">
                        <pre class="m-0 max-h-[32rem] overflow-auto p-3 text-xs whitespace-pre-wrap break-all">
                          {JSON.stringify(event, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  </Show>
                </>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}
