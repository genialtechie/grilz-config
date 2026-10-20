import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Link2, Share2 } from 'lucide-react';
import { breakable } from './breakable';
import { claimInfo, createClaimLink, revokeClaimLink, type ClaimLinkRow } from './data';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Admin → shop → Team (MAG-89): a claim link for a shop VVS Lab built ahead of
 * time. The jeweler scans the QR code at the counter, enters their email and
 * the shop is theirs. Only the link's hash is stored, so the QR code shows
 * once, right after it's made.
 */
export function ClaimLinkCard({ tenantId, shopName }: { tenantId: string; shopName: string }) {
  const [info, setInfo] = useState<{ link: ClaimLinkRow | null; owned: boolean } | null>(null);
  const [fresh, setFresh] = useState<{ id: string; url: string; expiresAt: string; qr: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => claimInfo(tenantId).then(setInfo).catch((reason: Error) => setError(reason.message)), [tenantId]);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const make = () =>
    act(async () => {
      const link = await createClaimLink(tenantId);
      const qr = await QRCode.toDataURL(link.url, { margin: 1, width: 480, errorCorrectionLevel: 'M', color: { dark: '#1b1714', light: '#ffffff' } });
      setFresh({ ...link, qr });
      setCopied(false);
    });
  const revoke = (id: string) =>
    act(async () => {
      await revokeClaimLink(tenantId, id);
      setFresh(null);
    });
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard access: the link is on screen to copy by hand.
    }
  };
  const share = async (url: string) => {
    const text = `Your VVS Lab shop, ${shopName}, is ready. Tap to claim it:`;
    if (navigator.share) {
      await navigator.share({ title: `${shopName} on VVS Lab`, text, url }).catch(() => undefined);
    } else {
      window.location.href = `sms:?&body=${encodeURIComponent(`${text} ${url}`)}`;
    }
  };

  const link = info?.link ?? null;
  const open = link && !link.claimed_at && !link.revoked_at && Date.parse(link.expires_at) > Date.now();

  return (
    <section className="admin-card admin-section claim-card">
      <h2>Claim link</h2>
      <p className="admin-muted admin-section__hint">Built this shop for a jeweler? They scan the code, enter their email and it’s theirs: owner, 14-day free trial, signed in on their phone. A link works once and lasts 7 days.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {!info ? (
        <p className="admin-muted">Loading…</p>
      ) : link?.claimed_at ? (
        <p className="claim-card__claimed"><Check size={16} /> Claimed by <strong>{link.claimed_email}</strong> on {when(link.claimed_at)}.</p>
      ) : info.owned ? (
        <p className="admin-muted">This shop already has an owner, so it can’t be claimed.</p>
      ) : fresh && open && fresh.id === link?.id ? (
        <div className="claim-card__fresh">
          <img className="claim-card__qr" src={fresh.qr} alt={`QR code to claim ${shopName}`} width="240" height="240" />
          <div className="claim-card__side">
            <div className="claim-card__url">{breakable(fresh.url)}</div>
            <div className="claim-card__actions">
              <button className="admin-button admin-button--small" type="button" onClick={() => void copy(fresh.url)}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
              <button className="admin-button admin-button--small" type="button" onClick={() => void share(fresh.url)}><Share2 size={14} /> Share</button>
              <button className="admin-button admin-button--small" type="button" disabled={busy} onClick={() => void revoke(fresh.id)}>Cancel link</button>
            </div>
            <p className="admin-muted dash-small">Works until {day(fresh.expiresAt)}. This code shows only now; making a new link cancels this one.</p>
          </div>
        </div>
      ) : open && link ? (
        <div className="claim-card__actions">
          <p className="admin-muted dash-small claim-card__note">A link is open until {day(link.expires_at)}. Its code was shown when it was made; make a new one to show a code again.</p>
          <button className="admin-button admin-button--primary admin-button--small" type="button" disabled={busy} onClick={() => void make()}><Link2 size={14} /> Make a new link</button>
          <button className="admin-button admin-button--small" type="button" disabled={busy} onClick={() => void revoke(link.id)}>Cancel link</button>
        </div>
      ) : (
        <button className="admin-button admin-button--primary" type="button" disabled={busy} onClick={() => void make()}><Link2 size={15} /> {busy ? 'Making the link…' : 'Create claim link'}</button>
      )}
    </section>
  );
}
