export function SinOperacionBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        color: 'var(--color-text-secondary)',
        backgroundColor: 'color-mix(in srgb, var(--color-text-secondary) 12%, transparent)',
      }}
    >
      Sin operación
    </span>
  );
}
