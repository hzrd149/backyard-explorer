import { Show } from "solid-js";
import { useSearch } from "../../context/SearchContext";

interface HiddenResultsNoticeProps {
  /** Number of results this view could not render */
  count: number;
}

/** Footer telling the user some results were skipped by the current view */
export default function HiddenResultsNotice(props: HiddenResultsNoticeProps) {
  const { appendToSearch } = useSearch();

  return (
    <Show when={props.count > 0}>
      <div class="mt-6 text-center text-sm text-base-content/60">
        {props.count} result{props.count !== 1 ? "s" : ""} not shown in this
        view ·{" "}
        <button
          class="link link-primary"
          onClick={() => appendToSearch("view:timeline")}
        >
          Show as timeline
        </button>
      </div>
    </Show>
  );
}
