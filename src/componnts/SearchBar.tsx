import { createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { searchExamples } from "../examples";

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
  let intervalId: number | undefined;

  // Sync with external value prop (from URL)
  createEffect(() => {
    if (props.value !== undefined) {
      setQuery(props.value);
    }
  });

  // Rotate through examples for placeholder
  onMount(() => {
    const updatePlaceholder = () => {
      const examples = searchExamples;
      const currentIndex = currentExampleIndex();
      const exampleToShow = examples[currentIndex];
      setCurrentDisplayedExample(exampleToShow);
      setPlaceholder(`Try: ${exampleToShow}`);
      setCurrentExampleIndex((currentIndex + 1) % examples.length);
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
    </div>
  );
}
