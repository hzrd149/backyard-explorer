import { createContext, useContext, type ParentProps } from "solid-js";

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
