import { For, Show } from "solid-js";
import {
  DISPLAY_MODES,
  getDisplayModeInfo,
  stripViewTokens,
  type ResolvedDisplayMode,
} from "../../services/DisplayService";
import { useSearch } from "../../context/SearchContext";

interface DisplaySwitcherProps {
  query: string;
  resolved: ResolvedDisplayMode;
}

/** Dropdown for picking how results are displayed; writes `view:` to the query */
export default function DisplaySwitcher(props: DisplaySwitcherProps) {
  const { updateSearch } = useSearch();
  const current = () => getDisplayModeInfo(props.resolved.mode);

  const select = (mode: string | null) => {
    const base = stripViewTokens(props.query);
    updateSearch(mode ? `${base} view:${mode}`.trim() : base);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div class="flex items-center gap-2">
      <Show when={props.resolved.invalid}>
        <span
          class="badge badge-warning badge-sm"
          title={`Unknown view "${props.resolved.invalid}"`}
        >
          unknown view:{props.resolved.invalid}
        </span>
      </Show>
      <div class="dropdown dropdown-end">
        <div tabindex="0" role="button" class="btn btn-sm">
          <span>{current().icon}</span>
          {current().label}
          <Show when={!props.resolved.explicit}>
            <span class="badge badge-ghost badge-xs">auto</span>
          </Show>
          <span class="opacity-60">▾</span>
        </div>
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 rounded-box z-40 mt-1 w-48 p-2 shadow-lg border border-base-300"
        >
          <li>
            <button
              classList={{ "menu-active": !props.resolved.explicit }}
              onClick={() => select(null)}
            >
              ✨ Auto
            </button>
          </li>
          <For each={DISPLAY_MODES}>
            {(mode) => (
              <li>
                <button
                  classList={{
                    "menu-active":
                      props.resolved.explicit &&
                      props.resolved.mode === mode.id,
                  }}
                  onClick={() => select(mode.id)}
                >
                  <span>{mode.icon}</span>
                  {mode.label}
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  );
}
