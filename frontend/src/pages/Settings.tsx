import { C } from '../theme';

const font = "'DM Mono', monospace";

export default function Settings() {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 3, color: C.textFaint, textTransform: 'uppercase', marginBottom: 5, fontFamily: font }}>Settings</div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: -0.5, fontFamily: font }}>Settings</h1>
      <div style={{ marginTop: 40, textAlign: 'center', color: C.textSoft, fontSize: 13, fontFamily: font }}>
        Settings page coming soon.
      </div>
    </div>
  );
}
