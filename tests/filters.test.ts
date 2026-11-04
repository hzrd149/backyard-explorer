import { describe, expect, it } from "vitest";
import type { NostrEvent } from "nostr-tools";
import {
  applyResultFilters,
  DEFAULT_FILTER_SETTINGS,
  filterWords,
  kindFacets,
  type ResultFilterSettings,
} from "../src/services/ResultFilters";

let counter = 0;
const event = (
  kind: number,
  tags: string[][] = [],
  content = "",
): NostrEvent => ({
  id: (counter++).toString(16).padStart(64, "0"),
  pubkey: "0".repeat(64),
  created_at: 1_700_000_000,
  kind,
  tags,
  content,
  sig: "",
});

const ROOT = "a".repeat(64);
const PK = "b".repeat(64);

const note = event(1, [], "Hello Nostr world");
const reply = event(1, [["e", ROOT, "", "root"]], "a reply");
const mention = event(1, [["e", ROOT, "", "mention"]], "quoting");
const comment = event(1111, [["E", ROOT]], "a comment");
const repost = event(6, [["e", ROOT]]);
const nsfw = event(1, [["content-warning", "nudity"]]);
const nsfwTag = event(1, [["t", "NSFW"]]);
const dm = event(4, [], "abc?iv=0123456789abcdefABCD==");
const nip04 = event(1, [], "abc?iv=0123456789abcdefABCD==");
const bridged = event(1, [["proxy", "https://x", "activitypub"]]);
const spam = event(1, [
  ["t", "a"],
  ["t", "b"],
  ["t", "c"],
  ["p", PK],
  ["p", PK],
]);
const contacts = event(3, [
  ["p", PK],
  ["p", PK],
  ["p", PK],
]);
const article = event(30023, [["title", "Bitcoin Mining Guide"]], "body");

const all = [
  note,
  reply,
  mention,
  comment,
  repost,
  nsfw,
  nsfwTag,
  dm,
  nip04,
  bridged,
  spam,
  contacts,
  article,
];

const run = (patch: Partial<ResultFilterSettings>, text = "") =>
  applyResultFilters(all, { ...DEFAULT_FILTER_SETTINGS, ...patch }, text);

describe("applyResultFilters", () => {
  it("shows everything by default", () => {
    expect(run({}).visible).toHaveLength(all.length);
  });

  it("hides replies but not mentions", () => {
    const { visible, reasons } = run({ hideReplies: true });
    expect(visible).not.toContain(reply);
    expect(visible).not.toContain(comment);
    expect(visible).toContain(mention);
    expect(reasons.replies).toBe(2);
  });

  it("hides reposts, sensitive, encrypted and bridged events", () => {
    expect(run({ hideReposts: true }).visible).not.toContain(repost);
    const sensitive = run({ hideNsfw: true }).visible;
    expect(sensitive).not.toContain(nsfw);
    expect(sensitive).not.toContain(nsfwTag);
    const encrypted = run({ hideEncrypted: true }).visible;
    expect(encrypted).not.toContain(dm);
    expect(encrypted).not.toContain(nip04);
    expect(run({ hideBridged: true }).visible).not.toContain(bridged);
  });

  it("caps hashtags and mentions, ignoring lists", () => {
    expect(run({ maxHashtags: 2 }).visible).not.toContain(spam);
    const mentions = run({ maxMentions: 1 }).visible;
    expect(mentions).not.toContain(spam);
    expect(mentions).toContain(contacts);
  });

  it("filters by every word, in content and titles", () => {
    expect(run({}, "nostr HELLO").visible).toEqual([note]);
    expect(run({}, "mining").visible).toEqual([article]);
    expect(run({}, '"nostr world"').visible).toEqual([note]);
  });

  it("turns rules off with the master switch, but keeps the text filter", () => {
    expect(run({ enabled: false, hideReposts: true }).visible).toContain(
      repost,
    );
    expect(run({ enabled: false }, "mining").visible).toEqual([article]);
  });
});

describe("filterWords", () => {
  it("keeps quoted phrases", () => {
    expect(filterWords('a "b c" D')).toEqual(["a", "b c", "d"]);
  });
});

describe("kindFacets", () => {
  it("counts kinds, most common first", () => {
    expect(kindFacets(all).slice(0, 2)).toEqual([
      { kind: 1, count: 8, label: "notes" },
      { kind: 3, count: 1, label: "follow lists" },
    ]);
  });
});
