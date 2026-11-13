import { initials } from "@/lib/format";

export function Avatar({
  name,
  color,
  size = 48,
  className = "",
  online = false,
}: {
  name: string;
  color?: string | null;
  size?: number;
  className?: string;
  online?: boolean;
}) {
  const base = color || "#8774e1";
  return (
    <div
      className={`relative grid shrink-0 select-none place-items-center rounded-full font-semibold text-white ring-1 ring-white/10 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        background: `linear-gradient(145deg, ${base}, color-mix(in srgb, ${base} 58%, #000))`,
      }}
      aria-hidden
    >
      {initials(name)}
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-panel bg-emerald-400"
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
        />
      )}
    </div>
  );
}
