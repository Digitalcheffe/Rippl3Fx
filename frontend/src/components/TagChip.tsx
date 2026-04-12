import { C } from '../theme';

const font = "'DM Mono', monospace";

export default function TagChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 4,
      background: C.accentSoft, color: C.accent,
      border: `1px solid ${C.accent}30`, fontFamily: font,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {name}
      {onRemove && (
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', color: C.accent,
          fontSize: 10, cursor: 'pointer', padding: 0, lineHeight: 1,
        }}>x</button>
      )}
    </span>
  );
}
