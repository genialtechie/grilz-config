import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { BarChart3, ExternalLink, Inbox, LogOut, Mail, Store, Users } from 'lucide-react';
import { acceptInvites, myShops, type MyShop } from '../admin/data';
import { LeadsPanel } from '../admin/LeadsPanel';
import { ShopEditor } from '../admin/ShopEditor';
import { supabase } from '../admin/supabase';
import { StatsPanel } from './StatsPanel';
import { TeamPanel } from './TeamPanel';
import '../admin/admin.css';
import './dashboard.css';

// /dashboard: the jeweler's own console. Sign in with a magic link (accounts are
// created by invitation only), then work leads, change prices and options,
// see the week's numbers and manage the team. Row-level security limits every
// query to the shops the person belongs to.

function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState('sending');
    const { error: authError } = await supabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      // Invitation only: an address without an account gets no email.
      options: { emailRedirectTo: `${window.location.origin}/dashboard`, shouldCreateUser: false },
    });
    // Same answer whether or not the address has an account, so the form can't
    // be used to find out who's a customer.
    if (authError && !/signups? not allowed|not found|otp/i.test(authError.message)) {
      setError(authError.message);
      setState('error');
    } else setState('sent');
  };

  return (
    <main className="admin-auth">
      <form className="admin-card admin-auth__card" onSubmit={submit}>
        <h1>Your VVS Lab shop</h1>
        {state === 'sent' ? (
          <p>If {email} is on a shop&apos;s team, a sign-in link is on its way. You can close this tab.</p>
        ) : (
          <>
            <p className="admin-muted">Sign in to see your design requests and update your prices.</p>
            <label className="admin-field">
              <span>Email</span>
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>
            {state === 'error' && <p className="admin-error" role="alert">{error}</p>}
            <button className="admin-button admin-button--primary" type="submit" disabled={state === 'sending'}>
              <Mail size={16} /> {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            <p className="admin-muted dash-small">New here? Your shop owner adds you from their dashboard.</p>
          </>
        )}
      </form>
    </main>
  );
}

function ShopShell({ shops, email }: { shops: MyShop[]; email: string }) {
  const { slug = '' } = useParams();
  const shop = shops.find((item) => item.slug === slug);
  if (!shop) return <Navigate to="/dashboard" replace />;
  const base = `/dashboard/${shop.slug}`;
  const tabs = [
    { to: base, end: true, icon: <Inbox size={16} />, label: 'Leads' },
    { to: `${base}/shop`, end: false, icon: <Store size={16} />, label: 'Shop' },
    { to: `${base}/stats`, end: false, icon: <BarChart3 size={16} />, label: 'Stats' },
    { to: `${base}/team`, end: false, icon: <Users size={16} />, label: 'Team' },
  ];

  return (
    <div className="admin dash">
      <header className="admin-header">
        <div className="dash-header__shop">
          <span className="admin-header__brand">{shop.name}</span>
          {shops.length > 1 && <Link to="/dashboard" className="admin-muted dash-small">Switch shop</Link>}
        </div>
        <div className="admin-header__user">
          <a className="admin-button admin-button--small" href={`/b/${shop.slug}`} target="_blank" rel="noopener"><ExternalLink size={14} /> Your page</a>
          <span className="dash-hide-sm">{email}</span>
          <button className="admin-icon-button" type="button" onClick={() => void supabase().auth.signOut()} aria-label="Sign out"><LogOut size={16} /></button>
        </div>
      </header>
      <nav className="dash-nav" aria-label="Dashboard">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => (isActive ? 'is-active' : '')}>
            {tab.icon}<span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<main className="admin-main"><h1 className="dash-h1">Design requests</h1><LeadsPanel tenantId={shop.id} shopName={shop.name} /></main>} />
        <Route path="shop" element={<ShopEditor mode="shop" slug={shop.slug} role={shop.role} />} />
        <Route path="stats" element={<StatsPanel shop={shop} />} />
        <Route path="team" element={<TeamPanel shop={shop} />} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </div>
  );
}

function ShopPicker({ shops }: { shops: MyShop[] }) {
  if (shops.length === 1) return <Navigate to={`/dashboard/${shops[0].slug}`} replace />;
  return (
    <main className="admin-auth">
      <div className="admin-card admin-auth__card">
        <h1>Choose a shop</h1>
        <div className="dash-shops">
          {shops.map((shop) => (
            <Link key={shop.id} to={`/dashboard/${shop.slug}`} className="admin-button">{shop.name}<span className="admin-muted"> · {shop.role}</span></Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function DashboardApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [shops, setShops] = useState<MyShop[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const db = supabase();
    void db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    document.title = 'Your shop · VVS Lab';
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setShops(null);
      return;
    }
    // Accept any pending invites for this email first, then list the shops.
    acceptInvites()
      .catch(() => 0)
      .then(() => myShops())
      .then(setShops)
      .catch((reason: Error) => setError(reason.message));
  }, [session]);

  if (session === undefined || (session && !shops && !error)) return <div className="admin-loading">Loading…</div>;
  if (!session) return <SignIn />;
  if (error || !shops?.length) {
    return (
      <main className="admin-auth">
        <div className="admin-card admin-auth__card">
          <h1>No shop yet</h1>
          <p>{error || `${session.user.email} isn't on a shop's team. Ask the shop owner to add you, or message VVS Lab.`}</p>
          <button className="admin-button" type="button" onClick={() => void supabase().auth.signOut()}>Sign out</button>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route index element={<ShopPicker shops={shops} />} />
      <Route path=":slug/*" element={<ShopShell shops={shops} email={session.user.email ?? ''} />} />
    </Routes>
  );
}
