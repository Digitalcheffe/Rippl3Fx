import { useState, useEffect } from 'react';
import { C } from '../theme';
import { apiGet } from '../api/client';

const font = "'DM Mono', monospace";

interface Stat {
  label: string;
  value: string;
}

interface AccountStatsProps {
  accountId: number;
  platform: string;
}

export default function AccountStats({ accountId, platform }: AccountStatsProps) {
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet<Stat[]>(`/accounts/${accountId}/stats`)
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  const platformColor = (C[platform as keyof typeof C] || C.accent) as string;

  if (loading || stats.length === 0) return null;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', boxShadow: '0 2px 8px rgba(30,58,95,0.06)', position: 'sticky', top: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: C.textMid, textTransform: 'uppercase', fontFamily: font, marginBottom: 14 }}>Account Overview</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {stats.map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 10, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1, fontFamily: font, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: platformColor, fontFamily: font, lineHeight: 1.2 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
