import { createSignal, onCleanup } from "solid-js";

/**
 * Returns a ref setter and a signal that flips to true (once) when the element
 * comes within `rootMargin` of the viewport. Used to defer media requests so a
 * long feed doesn't hit the Blossom server for every item at once.
 */
export function createInViewport(rootMargin = "200px") {
  const [visible, setVisible] = createSignal(false);
  let observer: IntersectionObserver | undefined;

  const ref = (el: Element) => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer?.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
  };

  onCleanup(() => observer?.disconnect());

  return [ref, visible] as const;
}
