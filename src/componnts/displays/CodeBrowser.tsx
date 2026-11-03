import { createMemo, For, Show } from "solid-js";
import {
  getCodeSnippetDescription,
  getCodeSnippetExtension,
  getCodeSnippetLanguage,
  getCodeSnippetName,
} from "applesauce-common/helpers/code-snippet";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import CopyButton from "./CopyButton";
import HiddenResultsNotice from "./HiddenResultsNotice";
import { formatDate } from "./format";
import type { DisplayProps } from "./types";

/** List of NIP-C0 code snippets with their source */
export default function CodeBrowser(props: DisplayProps) {
  const snippets = createMemo(() =>
    props.events.filter((e) => e.kind === 1337),
  );

  return (
    <>
      <div class="space-y-4">
        <For each={snippets()}>
          {(event) => {
            const name = getCodeSnippetName(event);
            const language = getCodeSnippetLanguage(event);
            const extension = getCodeSnippetExtension(event);
            const description = getCodeSnippetDescription(event);
            return (
              <div class="rounded-box border border-base-300 bg-base-100 shadow-sm overflow-hidden">
                <div class="flex flex-wrap items-center gap-2 border-b border-base-300 px-4 py-2">
                  <span class="font-mono font-semibold">
                    {name || "snippet"}
                    <Show when={extension && !name?.endsWith(`.${extension}`)}>
                      .{extension}
                    </Show>
                  </span>
                  <Show when={language}>
                    <span class="badge badge-primary badge-sm">{language}</span>
                  </Show>
                  <span class="ml-auto flex items-center gap-2 text-xs text-base-content/60">
                    <UserAvatar pubkey={event.pubkey} size="xs" />
                    <UserName pubkey={event.pubkey} maxLength={16} />
                    <span>· {formatDate(event.created_at)}</span>
                    <CopyButton value={event.content} label="Copy" />
                  </span>
                </div>
                <Show when={description}>
                  <p class="px-4 pt-2 text-sm text-base-content/70">
                    {description}
                  </p>
                </Show>
                <pre class="m-0 max-h-96 overflow-auto bg-base-200 p-4 text-xs leading-relaxed">
                  <code>{event.content}</code>
                </pre>
              </div>
            );
          }}
        </For>
      </div>
      <Show when={props.complete && snippets().length === 0}>
        <p class="text-center text-base-content/50 mt-8">
          No code snippets found in these results.
        </p>
      </Show>
      <HiddenResultsNotice count={props.events.length - snippets().length} />
    </>
  );
}
