export function RavaniMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18.5 8.5A7.25 7.25 0 0 0 6.2 6.1L4.5 8" />
      <path d="M18.5 4v4.5H14" />
      <path d="M5.5 15.5a7.25 7.25 0 0 0 12.3 2.4l1.7-1.9" />
      <path d="M5.5 20v-4.5H10" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
