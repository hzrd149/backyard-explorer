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
    const trimmedQuery = currentQuery.trim();
    const trimmedTerm = term.trim();

    if (!trimmedQuery) {
      props.updateSearch(trimmedTerm);
      return;
    }

    // Check if the term is already in the query
    if (trimmedQuery.includes(trimmedTerm)) {
      return;
    }

    props.updateSearch(`${trimmedQuery} ${trimmedTerm}`);
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
