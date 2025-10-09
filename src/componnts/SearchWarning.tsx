export default function SearchWarning() {
  return (
    <div class="alert alert-warning shadow-lg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="stroke-current shrink-0 h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      <div>
        <h3 class="font-bold">Text Search Not Supported</h3>
        <div class="text-xs">
          Your local Nostr relay does not support text search functionality. You
          can still use filter queries like{" "}
          <code class="bg-base-300 px-1 py-0.5 rounded text-xs">
            by:username
          </code>
          ,<code class="bg-base-300 px-1 py-0.5 rounded text-xs">kind:1</code>,
          or
          <code class="bg-base-300 px-1 py-0.5 rounded text-xs">#hashtag</code>.
        </div>
      </div>
    </div>
  );
}
