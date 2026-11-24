/** Five bars rising and falling in a wave. Uses the brand colour by default. */
export default function Wave({ size = 48, duration = 900, label = "Loading", className = "" }: {
  size?: number; duration?: number; label?: string; className?: string;
}) {
  return (
    <span
      role="img" aria-label={label}
      className={`inline-flex items-center justify-center text-primary ${className}`}
      style={{ width: size, height: size, gap: size * 0.08 }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i} className="wave-bar"
          style={{ width: size * 0.1, height: size, animationDuration: `${duration}ms`, animationDelay: `${-duration + i * (duration / 10)}ms` }}
        />
      ))}
    </span>
  );
}
