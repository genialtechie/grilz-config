import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { connectStripe, stripeStatus, type ConnectStatus } from '../admin/data';

// The shop's own Stripe account for card deposits. Onboarding is hosted by
// Stripe; deposits go straight to the shop, never through VVS Lab.

export function StripeConnect({ tenantId, canManage, onStatus }: { tenantId: string; canManage: boolean; onStatus?: (status: ConnectStatus) => void }) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    stripeStatus(tenantId)
      .then((result) => {
        setStatus(result);
        onStatus?.(result);
      })
      .catch(() => setStatus({ connected: false, chargesEnabled: false }));
    // onStatus is a notification; re-running for a new callback isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      window.location.href = (await connectStripe(tenantId)).url;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  };

  if (!status) return <p className="admin-muted">Checking Stripe…</p>;
  if (status.chargesEnabled) {
    return (
      <p className="dash-stripe is-on"><CreditCard size={15} /> Stripe connected. Customers can pay the deposit by card, straight into your account.{' '}
        <a href="https://dashboard.stripe.com" target="_blank" rel="noopener">Open Stripe <ExternalLink size={12} /></a>
      </p>
    );
  }
  return (
    <div className="dash-stripe">
      <p className="admin-muted">
        {status.connected
          ? 'Stripe needs a few more details before you can take card deposits.'
          : 'Connect your Stripe account (or create one) to take deposits by card. The money goes straight to you.'}
      </p>
      {canManage ? (
        <button className="admin-button" type="button" disabled={busy} onClick={() => void connect()}>
          <CreditCard size={15} /> {busy ? 'Opening Stripe…' : status.connected ? 'Finish Stripe setup' : 'Connect Stripe'}
        </button>
      ) : (
        <p className="admin-muted">The shop owner connects Stripe.</p>
      )}
      {error && <p className="admin-error">{error}</p>}
    </div>
  );
}
