import type { ReactNode } from 'react';
import './auth.css';

// The pages a jeweler sees around the emails (sign up, sign in, check your
// email) share the emails' look: one cream surface, the VVS mark, a serif
// headline with one italic red word, one red button. Karat is for moments
// (going live, a win), not for these utility screens; `karat` is there for those.

export type KaratMood = 'wink' | 'cool' | 'working' | 'nudge' | 'hype' | 'tarnished';

export function AuthPage({ karat, title, lead, children, foot }: { karat?: KaratMood; title: ReactNode; lead?: ReactNode; children?: ReactNode; foot?: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth__column">
        <a className="auth__mark" href="/" aria-label="VVS Lab home"><img src="/assets/email/vvs-mark.png" alt="VVS Lab" width="73" height="32" /></a>
        {karat && <img className="auth__karat" src={`/assets/mascot/karat-${karat}.png`} alt="" width="132" height="132" />}
        <h1 className="auth__title">{title}</h1>
        {lead && <p className="auth__lead">{lead}</p>}
        {children}
        {foot && <div className="auth__foot">{foot}</div>}
      </div>
      <footer className="auth__legal">
        <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · Magpollo Corp
      </footer>
    </main>
  );
}
