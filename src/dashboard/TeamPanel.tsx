import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { inviteMember, removeMember, setMemberRole, shopTeam, type MemberRole, type MyShop, type TeamMember } from '../admin/data';
import { supabase } from '../admin/supabase';
import './dashboard.css';

// Who can sign in to the shop. Owners add people (the server creates the account
// and emails a sign-in link), change roles and remove them. Staff work leads
// and edit drafts; owners also publish, upload the logo and manage the team.

export function TeamPanel({ shop, embedded = false }: { shop: MyShop; embedded?: boolean }) {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [me, setMe] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('staff');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const owner = shop.role === 'owner' || shop.role === 'admin';

  const load = useCallback(() => shopTeam(shop.id).then(setTeam).catch((reason: Error) => setNotice({ kind: 'error', text: reason.message })), [shop.id]);

  useEffect(() => {
    void load();
    void supabase().auth.getUser().then(({ data }) => setMe(data.user?.id ?? ''));
  }, [load]);

  const act = async (work: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ kind: 'ok', text: await work() });
      await load();
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : String(reason);
      setNotice({ kind: 'error', text: /at least one owner/.test(text) ? 'A shop needs at least one owner.' : text });
    } finally {
      setBusy(false);
    }
  };

  const invite = (event: FormEvent) => {
    event.preventDefault();
    void act(async () => {
      const result = await inviteMember(shop.id, email, role);
      setEmail('');
      if (!result.added) return result.message ?? 'Already on the team.';
      return result.emailed ? `Added. We emailed ${email} a sign-in link.` : `Added. The email didn't send, so ask them to sign in at ${window.location.origin}/dashboard.`;
    });
  };

  return (
    <main className={embedded ? '' : 'admin-main'}>
      {!embedded && <h1 className="dash-h1">Team</h1>}
      {embedded && <p className="admin-muted">Add the shop owner here: they get an email to sign in at /dashboard, where they manage leads, prices and their own team.</p>}
      {notice && <p className={notice.kind === 'ok' ? 'admin-notice' : 'admin-error admin-notice'} role="status">{notice.text}</p>}
      <section className="admin-card admin-section">
        {!team ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <ul className="dash-team">
            {team.map((member) => (
              <li key={member.user_id}>
                <div>
                  <strong>{member.email}</strong>{member.user_id === me && <span className="admin-muted"> (you)</span>}
                  <div className="admin-muted dash-small">{member.last_sign_in_at ? `Last signed in ${new Date(member.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Hasn’t signed in yet'}</div>
                </div>
                {owner ? (
                  <select value={member.role} disabled={busy} aria-label={`Role for ${member.email}`} onChange={(event) => void act(async () => { await setMemberRole(shop.id, member.user_id, event.target.value as MemberRole); return 'Role updated.'; })}>
                    <option value="owner">Owner</option>
                    <option value="staff">Staff</option>
                  </select>
                ) : (
                  <span className="admin-muted">{member.role === 'owner' ? 'Owner' : 'Staff'}</span>
                )}
                {(owner || member.user_id === me) && (
                  <button className="admin-icon-button" type="button" disabled={busy} aria-label={member.user_id === me ? 'Leave this shop' : `Remove ${member.email}`}
                    onClick={() => {
                      if (!window.confirm(member.user_id === me ? `Leave ${shop.name}? You'll lose access.` : `Remove ${member.email} from ${shop.name}?`)) return;
                      void act(async () => { await removeMember(shop.id, member.user_id); return member.user_id === me ? 'You left the shop.' : 'Removed.'; });
                    }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {owner && (
        <section className="admin-card admin-section">
          <h2>Add someone</h2>
          <p className="admin-muted admin-section__hint">Staff see and update design requests and can edit drafts. Owners can also publish, change the logo and manage the team.</p>
          <form className="dash-invite" onSubmit={invite}>
            <input type="email" required value={email} placeholder="name@theirshop.com" onChange={(event) => setEmail(event.target.value)} aria-label="Email" />
            <select value={role} onChange={(event) => setRole(event.target.value as MemberRole)} aria-label="Role">
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
            </select>
            <button className="admin-button admin-button--primary" type="submit" disabled={busy}><UserPlus size={15} /> Add</button>
          </form>
        </section>
      )}
    </main>
  );
}
