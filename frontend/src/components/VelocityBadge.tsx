import { C } from '../theme';

const font = "'DM Mono', monospace";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export default function VelocityBadge({ value, label }: { value: number; label?: string }) {
  const color = value > 0 ? C.up : value < 0 ? C.down : C.flat;
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '—';
  const sign = value > 0 ? '+' : '';

  return (
    <span style={{ fontSize: 10, color, fontWeight: 700, fontFamily: font }}>
      {arrow} {sign}{fmt(Math.abs(value))}{label ? ` ${label}` : ''}
    </span>
  );
}
