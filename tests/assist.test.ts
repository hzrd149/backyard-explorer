import { describe, expect, it } from "vitest";
import {
  applySuggestion,
  describePlan,
  nakCommands,
  suggest,
  tokenAtCursor,
} from "../src/services/QueryAssist";
import { planQuery } from "../src/services/QueryPlanner";

const NOW = new Date("2026-10-04T12:00:00Z");
const RELAY = "ws://localhost:4869/";
const PUBKEY =
  "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";

const labels = (query: string, cursor = query.length) =>
  suggest(query, cursor, NOW)?.suggestions.map((s) => s.insert) ?? [];

describe("tokenAtCursor", () => {
  it("finds the word around the cursor", () => {
    expect(tokenAtCursor("hello since:3d", 9)).toMatchObject({
      text: "since:3d",
      start: 6,
      end: 14,
      field: "since",
      value: "3d",
    });
    expect(tokenAtCursor("hello ", 6)).toBeUndefined();
  });

  it("stops at parentheses and quotes", () => {
    expect(tokenAtCursor("by:(ali", 7)?.text).toBe("ali");
    expect(tokenAtCursor('"car" is', 8)?.text).toBe("is");
  });
});

describe("suggest", () => {
  it("completes field names", () => {
    expect(labels("si")).toEqual(["since:"]);
    expect(labels("bitcoin m")).toEqual(["mentions:", "m:"]);
    expect(labels("since")).toEqual(["since:"]);
  });

  it("completes values after the colon", () => {
    expect(labels("since:")).toContain("since:1w");
    expect(labels("until:")).toContain("until:2026-10-04");
    expect(labels("has:v")).toEqual(["has:video"]);
    expect(labels("view:im")).toEqual(["view:images"]);
    expect(labels("is:art")).toContain("is:article");
  });

  it("has nothing for free text, links or finished values", () => {
    expect(labels("bitcoin")).toEqual([]);
    expect(labels("https://x")).toEqual([]);
    expect(labels("has:video")).toEqual([]);
  });

  it("only completes the token under the cursor", () => {
    expect(labels("si bitcoin", 2)).toEqual(["since:"]);
  });
});

describe("applySuggestion", () => {
  it("replaces the token and spaces after finished values", () => {
    const token = tokenAtCursor("#nostr si", 9)!;
    expect(applySuggestion("#nostr si", token, "since:")).toEqual({
      query: "#nostr since:",
      cursor: 13,
    });
    const value = tokenAtCursor("has:v kind:1", 5)!;
    expect(applySuggestion("has:v kind:1", value, "has:video")).toEqual({
      query: "has:video kind:1",
      cursor: 9,
    });
    const last = tokenAtCursor("has:v", 5)!;
    expect(applySuggestion("has:v", last, "has:video").query).toBe(
      "has:video ",
    );
  });
});

describe("describePlan", () => {
  it("summarises each branch", () => {
    const plan = planQuery(
      "is:note #nostr since:2024-01-01 OR by:alice bitcoin",
      {
        now: NOW,
      },
    );
    expect(describePlan(plan)).toEqual([
      "notes · #nostr · since 2024-01-01",
      "“bitcoin” · by alice",
    ]);
  });

  it("describes profile lookups", () => {
    expect(describePlan(planQuery("p:alice", { now: NOW }))).toEqual([
      "profiles named “alice”",
    ]);
  });
});

describe("nakCommands", () => {
  it("builds one nak req per filter", () => {
    const filters = planQuery(
      `kind:1 #nostr by:${PUBKEY} OR "hi there" limit:5`,
      {
        now: NOW,
      },
    ).branches.map((b) => b.filter);
    expect(nakCommands(filters, RELAY).split("\n")).toEqual([
      `nak req -k 1 -a ${PUBKEY} -t t=nostr -l 500 ${RELAY}`,
      `nak req -l 5 --search '"hi there"' ${RELAY}`,
    ]);
  });
});
