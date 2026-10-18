import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, Trash2, UserPlus } from 'lucide-react';
import { exportShopData, inviteMember, pendingInvites, removeMember, revokeInvite, setMemberRole, shopTeam, type MemberRole, type MyShop, type PendingInvite, type TeamMember } from '../admin/data';
import { supabase } from '../admin/supabase';
import './dashboard.css';

// Who can sign in to the shop. Owners invite people (the server emails a sign-in link;
// they join when they accept), change roles and remove them. Staff work leads
// and edit drafts; owners also publish, upload the logo and manage the team.

export function TeamPanel({ shop, embedded = false }: { shop: MyShop; embedded?: boolean }) {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [me, setMe] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('staff');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const owner = shop.role === 'owner' || shop.role === 'admin';

  const load = useCallback(
    () =>
      Promise.all([shopTeam(shop.id), pendingInvites(shop.id)])
        .then(([members, invites]) => {
          setTeam(members);
          setPending(invites);
        })
        .catch((reason: Error) => setNotice({ kind: 'error', text: reason.message })),
    [shop.id],
  );

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
      return result.message;
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
        {pending.length > 0 && (
          <>
            <h3>Invited</h3>
            <ul className="dash-team">
              {pending.map((invite) => (
                <li key={invite.id}>
                  <div>
                    <strong>{invite.email}</strong>
                    <div className="admin-muted dash-small">Invited {new Date(invite.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · joins when they sign in</div>
                  </div>
                  <span className="admin-muted">{invite.role === 'owner' ? 'Owner' : 'Staff'}</span>
                  {owner && (
                    <button className="admin-icon-button" type="button" disabled={busy} aria-label={`Cancel invite for ${invite.email}`} onClick={() => void act(async () => { await revokeInvite(invite.id); return 'Invite cancelled.'; })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
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
      {owner && !embedded && (
        <section className="admin-card admin-section">
          <h2>Your data</h2>
          <p className="admin-muted admin-section__hint">Download everything we hold for {shop.name}: every version of your settings, every design request with its notes, and your team. Leads are kept for 24 months. If you leave VVS Lab, you can still download them for 90 days.</p>
          <button className="admin-button" type="button" disabled={busy} onClick={() => void act(async () => {
            const data = await exportShopData(shop);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            link.download = `${shop.slug}-vvslab-export-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            return 'Downloaded.';
          })}><Download size={15} /> Download all data</button>
        </section>
      )}
    </main>
  );
}
