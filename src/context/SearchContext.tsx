import { createContext, useContext, type ParentProps } from "solid-js";
import { parseQueryTree } from "../services/QueryParser";

/** Tokens that pick how results are shown or ordered; they stay outside groups */
const OPTION_TOKEN = /^(view|display|v|sort|order):\S+$/i;

/**
 * AND a term onto a query whose top level is an OR, e.g. `a OR b` + `kind:1`
 * gives `(a OR b) kind:1`. Returns undefined when the query has no top-level OR.
 */
export function andIntoQuery(query: string, term: string): string | undefined {
  const tokens = query.trim().split(/\s+/);
  const options = tokens.filter((t) => OPTION_TOKEN.test(t));
  const rest = tokens.filter((t) => !OPTION_TOKEN.test(t)).join(" ");
  try {
    if (parseQueryTree(rest).type !== "or") return undefined;
  } catch {
    return undefined;
  }
  return [`(${rest})`, term, ...options].join(" ");
}

interface SearchContextValue {
  updateSearch: (query: string) => void;
  appendToSearch: (term: string) => void;
}

const SearchContext = createContext<SearchContextValue>();

export function SearchProvider(
  props: ParentProps<{ updateSearch: (query: string) => void }>,
) {
  const appendToSearch = (term: string) => {
    const currentQuery =
      new URLSearchParams(window.location.search).get("q") || "";
    const trimmedTerm = term.trim();

    // Replacing tokens would break OR branches apart, so group them instead
    const grouped = andIntoQuery(currentQuery, trimmedTerm);
    if (grouped) {
      props.updateSearch(grouped);
      return;
    }

    // Derive the prefix of the incoming term (e.g. "by", "#", "from", etc.)
    // so we can replace any existing token with the same prefix.
    const colonIdx = trimmedTerm.indexOf(":");
    const termPrefix =
      colonIdx !== -1 ? trimmedTerm.slice(0, colonIdx + 1) : null;

    // Remove existing tokens that share the same prefix, then trim whitespace.
    let baseQuery = currentQuery.trim();
    if (termPrefix) {
      baseQuery = baseQuery
        .split(/\s+/)
        .filter((token) => !token.startsWith(termPrefix))
        .join(" ")
        .trim();
    }

    if (!baseQuery) {
      props.updateSearch(trimmedTerm);
      return;
    }

    // Check if the exact term is already present
    if (baseQuery.split(/\s+/).includes(trimmedTerm)) {
      return;
    }

    props.updateSearch(`${baseQuery} ${trimmedTerm}`);
  };

  return (
    <SearchContext.Provider
      value={{ updateSearch: props.updateSearch, appendToSearch }}
    >
      {props.children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);

  if (!context) {
    throw new Error("useSearch must be used within a SearchProvider");
  }

  return context;
}
