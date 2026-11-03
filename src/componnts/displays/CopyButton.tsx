import { createSignal } from "solid-js";

interface CopyButtonProps {
  value: string;
  label?: string;
  class?: string;
}

/** Small button that copies a value to the clipboard */
export default function CopyButton(props: CopyButtonProps) {
  const [copied, setCopied] = createSignal(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <button
      class={props.class ?? "btn btn-ghost btn-xs"}
      onClick={copy}
      title={`Copy ${props.label ?? ""}`.trim()}
    >
      {copied() ? "✓ Copied" : (props.label ?? "Copy")}
    </button>
  );
}
