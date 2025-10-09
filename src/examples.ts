// Search examples that we'll randomly select from and test
export const searchExamples = [
  // Basic
  "vibe coding",
  "nicolas-cage.gif",
  "#PenisButter is:note",
  "#YESTR",
  "#SovEng",
  "#gratefulchain",
  "#photography",
  "#artstr",
  "#asknostr is:note",

  // by:Author
  "by:fiatjaf",
  "by:@dergigi.com",
  "by:gigi",
  "by:pablof7z",
  "by:corndalorian",
  "by:snowden",
  "by:socrates",
  'is:note by:"Derek Ross"',

  // Combined
  "GM by:dergigi",
  "GM fiat by:fiatjaf",
  "good by:socrates",
  "engineering by:lyn",
  "stay humble by:odell",
  "#YESTR by:dergigi",
  "👀 by:dergigi",
  "NIP-EE by:jeffg",
  ".jpg by:corndalorian",
  "by:rektbot 💀💀💀💀💀💀💀💀💀💀",
  '"car crash" by:dergigi',
  "(PoW OR WoT) by:dergigi",
  "free by:ulbricht",
  "(nostr OR 🫂) by:snowden",
  '"GM PV" by:derek',
  "free by:ross",
  "freedom by:ulbricht",
  "knowledge by:platobot@dergigi.com",

  // Direct npub
  "GN by:npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc",
  "proof-of-work by:npub1satsv3728d65nenvkmzthrge0aduj8088dvwkxk70rydm407cl4s87sfhu",
  "essay by:npub1sfhflz2msx45rfzjyf5tyj0x35pv4qtq3hh4v2jf8nhrtl79cavsl2ymqt",

  // Kinds filter examples
  "is:bookmark by:hzrd",
  "is:file",
  "is:repost by:dor",
  "is:muted by:carvalho",
  "is:highlight",
  "is:code by:🌶️",
  "is:code by:hzrd149",
  "is:highlight by:dergigi",
  'is:highlight "proof of work"',
  "is:highlight (bitcoin OR nostr)",
  "is:highlight (by:fiatjaf.com OR by:@f7z.io)",
] as const;

// Examples that require login to work properly
const loginRequiredExamples = [] as const;

// Get examples filtered by login status
export function getFilteredExamples(isLoggedIn: boolean): readonly string[] {
  if (isLoggedIn) {
    return searchExamples;
  }

  // Filter out login-required examples
  return searchExamples.filter(
    (example) =>
      !(loginRequiredExamples as readonly string[]).includes(example),
  );
}

// Helper type for type safety
export type SearchExample = (typeof searchExamples)[number];
