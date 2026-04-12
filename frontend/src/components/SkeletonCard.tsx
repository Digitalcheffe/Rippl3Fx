import { C } from '../theme';

export default function SkeletonCard() {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderTop: `3px solid ${C.border}`, borderRadius: 12,
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ width: 80, height: 12, background: C.bgSection, borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: 140, height: 10, background: C.bgSection, borderRadius: 4 }} />
        </div>
        <div style={{ width: 50, height: 16, background: C.bgSection, borderRadius: 4 }} />
      </div>
      <div style={{ height: 1, background: C.border }} />
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 72, height: 28, background: C.bgSection, borderRadius: 4 }} />
          <div style={{ width: 76, height: 22, background: C.bgSection, borderRadius: 4 }} />
          <div style={{ width: 36, height: 12, background: C.bgSection, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}
