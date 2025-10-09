import { createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { searchExamples } from "../examples";
import {
  isSearchSupported,
  isLookupSupported,
} from "../services/SearchService";

interface SearchBarProps {
  onSearch: (query: string) => void;
  value?: string;
}

export default function SearchBar(props: SearchBarProps) {
  const [query, setQuery] = createSignal(props.value || "");
  const [currentExampleIndex, setCurrentExampleIndex] = createSignal(0);
  const [currentDisplayedExample, setCurrentDisplayedExample] =
    createSignal("");
  const [placeholder, setPlaceholder] = createSignal("");
  const [shuffledExamples, setShuffledExamples] = createSignal<string[]>([]);
  const [searchSupported, setSearchSupported] = createSignal<boolean | null>(
    null,
  );
  const [lookupSupported, setLookupSupported] = createSignal<boolean | null>(
    null,
  );
  let intervalId: number | undefined;

  // Fisher-Yates shuffle algorithm
  const shuffleArray = (array: string[]): string[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Sync with external value prop (from URL)
  createEffect(() => {
    if (props.value !== undefined) {
      setQuery(props.value);
    }
  });

  // Check support status on mount
  onMount(async () => {
    // Check search and lookup support
    try {
      const searchSupport = await isSearchSupported();
      const lookupSupport = await isLookupSupported();
      setSearchSupported(searchSupport);
      setLookupSupported(lookupSupport);
    } catch (error) {
      console.error("Failed to check support status:", error);
      setSearchSupported(false);
      setLookupSupported(false);
    }

    // Initialize shuffled examples
    const shuffled = shuffleArray([...searchExamples]);
    setShuffledExamples(shuffled);

    const updatePlaceholder = () => {
      const examples = shuffledExamples();
      if (examples.length === 0) return;

      const currentIndex = currentExampleIndex();
      const exampleToShow = examples[currentIndex];
      setCurrentDisplayedExample(exampleToShow);
      setPlaceholder(exampleToShow);

      // Move to next example, reshuffle when we reach the end
      const nextIndex = currentIndex + 1;
      if (nextIndex >= examples.length) {
        // Reshuffle for next cycle
        const newShuffled = shuffleArray([...searchExamples]);
        setShuffledExamples(newShuffled);
        setCurrentExampleIndex(0);
      } else {
        setCurrentExampleIndex(nextIndex);
      }
    };

    // Set initial placeholder
    updatePlaceholder();

    // Rotate every 3 seconds
    intervalId = setInterval(updatePlaceholder, 3000);
  });

  onCleanup(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const searchQuery = query().trim();
    // Allow empty search to clear results
    props.onSearch(searchQuery);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const searchQuery = query().trim();
      // Allow empty search to clear results
      props.onSearch(searchQuery);
    }
  };

  const handleSearchClick = () => {
    const searchQuery = query().trim();
    if (searchQuery) {
      // Use current input value
      props.onSearch(searchQuery);
    } else {
      // Use currently displayed example if input is empty
      const exampleToUse = currentDisplayedExample();
      if (exampleToUse) {
        props.onSearch(exampleToUse);
      }
    }
  };

  return (
    <div class="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div class="join w-full">
          <input
            type="search"
            placeholder={placeholder()}
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            class="input join-item input-bordered flex-1 text-lg input-lg"
          />
          <button
            type="button"
            onClick={handleSearchClick}
            class="btn join-item btn-primary btn-lg"
            title="Search"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>
      </form>

      {/* Support badges */}
      <div class="flex gap-2 mt-2">
        <div
          class={`badge badge-soft badge-sm ${searchSupported() ? "badge-success" : "badge-error"}`}
        >
          {searchSupported() === null ? "⏳" : searchSupported() ? "✓" : "✗"}{" "}
          Search
        </div>
        <div
          class={`badge badge-soft badge-sm ${lookupSupported() ? "badge-success" : "badge-error"}`}
        >
          {lookupSupported() === null ? "⏳" : lookupSupported() ? "✓" : "✗"}{" "}
          Lookup
        </div>
      </div>
    </div>
  );
}
