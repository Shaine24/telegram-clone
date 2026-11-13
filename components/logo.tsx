export function Logo({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      style={{ width: size, height: size }}
      className={`relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#45c4ff] via-[#3390ec] to-[#1b6fc4] shadow-[0_10px_30px_-10px_rgba(51,144,236,0.8)] ring-1 ring-white/20 ${className}`}
    >
      <svg
        viewBox="0 0 64 64"
        width={size * 0.68}
        height={size * 0.68}
        aria-hidden
      >
        <path
          d="M49.7 16.9 14.4 30.5c-2.3.9-2.3 2.3-.4 2.9l8.8 2.8 3.4 10.4c.4 1.1 1.4 1.4 2.3.5l4.7-4.6 8.5 6.3c1.6 1.1 3.2.5 3.7-1.5l6.2-25.3c.5-2.1-1.2-3.4-1.9-3.1Z"
          fill="#fff"
        />
        <path
          d="m27.4 36-1.3 7.3 3.3-3.2 6.7-8.9L27.4 36Z"
          fill="#cfeaff"
        />
      </svg>
    </div>
  );
}
