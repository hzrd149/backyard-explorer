import { useSearch } from "../context/SearchContext";

interface HashtagProps {
  tag: string;
  class?: string;
  clickable?: boolean;
}

export default function Hashtag(props: HashtagProps) {
  const { appendToSearch } = useSearch();

  const handleClick = () => {
    if (props.clickable !== false) {
      appendToSearch(`#${props.tag}`);
    }
  };

  return (
    <span
      class={`badge badge-ghost badge-sm ${props.clickable !== false ? "cursor-pointer hover:badge-primary" : ""} ${props.class || ""}`}
      onClick={handleClick}
    >
      #{props.tag}
    </span>
  );
}
