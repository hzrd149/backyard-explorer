/** Small check badge shown on media served through the local Blossom proxy */
export default function ProxiedBadge() {
  return (
    <div
      class="absolute top-1.5 right-1.5 bg-success text-success-content rounded-full p-0.5 shadow"
      title="Served via local Blossom proxy"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clip-rule="evenodd"
        />
      </svg>
    </div>
  );
}
