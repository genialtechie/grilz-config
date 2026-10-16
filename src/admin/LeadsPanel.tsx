import { useEffect, useState } from 'react';
import { displayContact } from '../lib/contact';
import { listLeads, setLeadStatus } from './data';

type Lead = Awaited<ReturnType<typeof listLeads>>[number];

const STATUSES = [
  ['new', 'New'],
  ['contacted', 'Contacted'],
  ['deposit_paid', 'Deposit paid'],
  ['won', 'Won'],
  ['lost', 'Lost'],
] as const;

const DELIVERY: Record<string, string> = { email_sent: 'Emailed', email_failed: 'Email failed', email_skipped: 'Not emailed' };
const RENDER: Record<string, string> = { ready: 'Photo', rendering: 'Rendering', paused: 'No photo (paused)', failed: 'No photo (failed)', none: '3D only' };
const usd = (value: number) => `$${Number(value).toLocaleString('en-US')}`;

/** A shop's recent leads, for support and white-glove onboarding checks. */
export function LeadsPanel({ tenantId }: { tenantId: string }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listLeads(tenantId).then(setLeads).catch((reason: Error) => setError(reason.message));
  }, [tenantId]);

  const changeStatus = async (lead: Lead, status: string) => {
    setLeads((current) => current?.map((item) => (item.id === lead.id ? { ...item, status } : item)) ?? null);
    try {
      await setLeadStatus(lead.id, status);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  if (error) return <p className="admin-error" role="alert">{error}</p>;
  if (!leads) return <p className="admin-muted">Loading leads…</p>;
  if (!leads.length) return <div className="admin-card admin-empty">No leads yet. Send a test design from the shop&apos;s page to check delivery.</div>;

  return (
    <div className="admin-leads">
      {leads.map((lead) => (
        <article key={lead.id} className="admin-card admin-lead">
          {lead.image ? <img src={lead.image} alt="" loading="lazy" /> : <div className="admin-lead__noimg" />}
          <div className="admin-lead__body">
            <div className="admin-lead__top">
              <strong>{lead.name}</strong>
              <span className="admin-muted">{new Date(lead.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            <div>{displayContact(lead.contact)}{lead.email ? ` · ${lead.email}` : ''}</div>
            <div className="admin-muted">{(lead.spec.summary ?? []).join(' · ')}</div>
            {lead.note && <div className="admin-lead__note">“{lead.note}”</div>}
            <div className="admin-lead__meta">
              <strong>{usd(lead.total)}</strong>
              {lead.deposit !== null && <span>deposit {usd(lead.deposit)}</span>}
              <span>{RENDER[lead.render_status] ?? lead.render_status}</span>
              <span className={lead.delivery === 'email_failed' ? 'admin-error' : ''}>{lead.delivery ? DELIVERY[lead.delivery] ?? lead.delivery : lead.notified_at ? 'Delivered' : 'Waiting for photo'}</span>
              {lead.source.utm_source && <span>from {lead.source.utm_source}</span>}
            </div>
          </div>
          <select value={lead.status} onChange={(event) => void changeStatus(lead, event.target.value)} aria-label={`Status for ${lead.name}`}>
            {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </article>
      ))}
    </div>
  );
}
