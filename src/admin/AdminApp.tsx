import { useEffect, useState, type FormEvent } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { LogOut, Mail } from 'lucide-react';
import { isAdmin } from './data';
import { NewShop } from './NewShop';
import { ShopEditor } from './ShopEditor';
import { ShopList } from './ShopList';
import { supabase } from './supabase';
import './admin.css';

// /admin: Magpollo's console to create, configure, preview and publish shops.
// Sign-in is a magic link; access is limited to platform admins by the database.

function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState('sending');
    const { error: authError } = await supabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/admin`, shouldCreateUser: false },
    });
    if (authError) {
      setError(authError.message);
      setState('error');
    } else setState('sent');
  };

  return (
    <main className="admin-auth">
      <form className="admin-card admin-auth__card" onSubmit={submit}>
        <h1>VVS Lab admin</h1>
        {state === 'sent' ? (
          <p>Check {email} for a sign-in link. You can close this tab.</p>
        ) : (
          <>
            <label className="admin-field">
              <span>Work email</span>
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>
            {state === 'error' && <p className="admin-error" role="alert">{error}</p>}
            <button className="admin-button admin-button--primary" type="submit" disabled={state === 'sending'}>
              <Mail size={16} /> {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </>
        )}
      </form>
    </main>
  );
}

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const db = supabase();
    void db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    document.title = 'VVS Lab admin';
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setAdmin(null);
      return;
    }
    void isAdmin().then(setAdmin).catch(() => setAdmin(false));
  }, [session]);

  if (session === undefined || (session && admin === null)) return <div className="admin-loading">Loading…</div>;
  if (!session) return <SignIn />;
  if (!admin) {
    return (
      <main className="admin-auth">
        <div className="admin-card admin-auth__card">
          <h1>No access</h1>
          <p>{session.user.email} isn&apos;t a VVS Lab admin.</p>
          <button className="admin-button" type="button" onClick={() => void supabase().auth.signOut()}>Sign out</button>
        </div>
      </main>
    );
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <Link to="/admin" className="admin-header__brand">VVS Lab <span>admin</span></Link>
        <div className="admin-header__user">
          <span>{session.user.email}</span>
          <button className="admin-icon-button" type="button" onClick={() => void supabase().auth.signOut()} aria-label="Sign out"><LogOut size={16} /></button>
        </div>
      </header>
      <Routes>
        <Route index element={<ShopList />} />
        <Route path="shops/new" element={<NewShop />} />
        <Route path="shops/:slug" element={<ShopEditor />} />
      </Routes>
    </div>
  );
}
