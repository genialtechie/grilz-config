import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, Instagram, Mail, MessageCircle, MessageSquare, Search, Trash2 } from 'lucide-react';
import { displayContact } from '../lib/contact';
import { addLeadNote, deleteLeadData, leadNotes, listLeads, setLeadStatus, type LeadEvent } from './data';
import { LEAD_STATUSES, leadsCsv, STATUS_LABEL } from './leadsCsv';
import { breakable } from './breakable';
const DELIVERY: Record<string, string> = { email_sent: 'Emailed', email_failed: 'Email failed', email_skipped: 'Not emailed' };
const RENDER: Record<string, string> = { ready: 'Photo', rendering: 'Rendering', paused: 'No photo (paused)', failed: 'No photo (failed)', none: '3D only' };

const usd = (value: number) => `$${Number(value).toLocaleString('en-US')}`;
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

type Lead = Awaited<ReturnType<typeof listLeads>>[number];

/** One tap to the customer, the way they asked to be reached (as in the lead email). */
function ContactActions({ lead }: { lead: Lead }) {
  const first = lead.name.split(/\s+/)[0] || lead.name;
  const phone = lead.contact.startsWith('+');
  const handle = lead.contact.replace(/^@/, '');
  return (
    <div className="admin-lead__actions">
      {phone ? (
        <a className="admin-button admin-button--small admin-lead__reach" href={`sms:${lead.contact}`}><MessageCircle size={14} /> Text {first}</a>
      ) : (
        <a className="admin-button admin-button--small admin-lead__reach" href={`https://ig.me/m/${encodeURIComponent(handle)}`} target="_blank" rel="noopener"><Instagram size={14} /> Message {first}</a>
      )}
      {lead.email && <a className="admin-button admin-button--small" href={`mailto:${lead.email}`}><Mail size={14} /> Email</a>}
    </div>
  );
}

function NoteForm({ onSave }: { onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSave(text.trim());
      setText('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="admin-note-form" onSubmit={submit}>
      <input value={text} maxLength={1000} placeholder="Add a note (only your team sees it)" onChange={(event) => setText(event.target.value)} aria-label="Add a note" />
      <button className="admin-button admin-button--small" type="submit" disabled={busy || !text.trim()}>Save</button>
    </form>
  );
}

/** A shop's leads: search, filter by status, notes, and CSV export. */
export function LeadsPanel({ tenantId, shopName = 'shop', canDelete = true }: { tenantId: string; shopName?: string; canDelete?: boolean }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [notes, setNotes] = useState<LeadEvent[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    listLeads(tenantId)
      .then(async (rows) => {
        setLeads(rows);
        setNotes(await leadNotes(rows.map((lead) => lead.id)));
      })
      .catch((reason: Error) => setError(reason.message));
  }, [tenantId]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (leads ?? []).filter((lead) => {
      if (filter !== 'all' && lead.status !== filter) return false;
      if (!needle) return true;
      return [lead.name, lead.contact, lead.email ?? '', lead.note ?? '', (lead.spec.summary ?? []).join(' ')].some((value) => value.toLowerCase().includes(needle));
    });
  }, [leads, query, filter]);

  const changeStatus = async (lead: Lead, status: string) => {
    const before = lead.status;
    setLeads((current) => current?.map((item) => (item.id === lead.id ? { ...item, status } : item)) ?? null);
    try {
      await setLeadStatus(lead.id, status);
      setNotes((current) => [...current, { lead_id: lead.id, type: 'status', created_at: new Date().toISOString(), data: { from: before, to: status } }]);
    } catch (reason) {
      setLeads((current) => current?.map((item) => (item.id === lead.id ? { ...item, status: before } : item)) ?? null);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const saveNote = async (lead: Lead, text: string) => {
    await addLeadNote(lead, tenantId, text);
    setNotes((current) => [...current, { lead_id: lead.id, type: 'note', created_at: new Date().toISOString(), data: { text } }]);
  };

  const removeLead = async (lead: Lead) => {
    if (!window.confirm(`Delete ${lead.name}'s design request, photo and notes for good? Do this when a customer asks you to delete their data.`)) return;
    try {
      await deleteLeadData(lead.id);
      setLeads((current) => current?.filter((item) => item.id !== lead.id) ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const exportCsv = () => {
    const blob = new Blob([`${String.fromCharCode(0xfeff)}${leadsCsv(shown, notes)}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (error && !leads) return <p className="admin-error" role="alert">{error}</p>;
  if (!leads) return <p className="admin-muted">Loading leads…</p>;
  if (!leads.length) return <div className="admin-card admin-empty">No design requests yet. Share your link in your bio and stories, and new requests show up here and in your inbox.</div>;

  const counts = Object.fromEntries(LEAD_STATUSES.map(([value]) => [value, leads.filter((lead) => lead.status === value).length]));

  return (
    <div className="admin-leads-wrap">
      <div className="admin-leads-tools">
        <label className="admin-search">
          <Search size={15} />
          <input type="search" value={query} placeholder="Search name, contact, design" onChange={(event) => setQuery(event.target.value)} aria-label="Search leads" />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by status">
          <option value="all">All ({leads.length})</option>
          {LEAD_STATUSES.map(([value, label]) => <option key={value} value={value}>{label} ({counts[value]})</option>)}
        </select>
        <button className="admin-button admin-button--small" type="button" onClick={exportCsv}><Download size={14} /> CSV</button>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {!shown.length && <p className="admin-muted">No leads match.</p>}
      <div className="admin-leads">
        {shown.map((lead) => {
          const history = notes.filter((item) => item.lead_id === lead.id);
          const noteCount = history.filter((item) => item.type === 'note').length;
          return (
            <article key={lead.id} className="admin-card admin-lead">
              {lead.image ? <img src={lead.image} alt="" loading="lazy" /> : <div className="admin-lead__noimg" />}
              <div className="admin-lead__body">
                <div className="admin-lead__top">
                  <strong>{lead.name}</strong>
                  <span className="admin-muted">{when(lead.created_at)}</span>
                </div>
                <div>{breakable(displayContact(lead.contact))}{lead.email && <> · {breakable(lead.email)}</>}</div>
                <div className="admin-muted">{(lead.spec.summary ?? []).join(' · ')}</div>
                {lead.note && <div className="admin-lead__note">“{lead.note}”</div>}
                <ContactActions lead={lead} />
                <div className="admin-lead__meta">
                  <strong>{usd(lead.total)}</strong>
                  {lead.deposit !== null && <span>deposit {usd(lead.deposit)}</span>}
                  {lead.promo?.amount ? <span>code {lead.promo.code} −{usd(lead.promo.amount)}</span> : null}
                  <span>{RENDER[lead.render_status] ?? lead.render_status}</span>
                  <span className={lead.delivery === 'email_failed' ? 'admin-error' : ''}>{lead.delivery ? DELIVERY[lead.delivery] ?? lead.delivery : lead.notified_at ? 'Delivered' : 'Waiting for photo'}</span>
                  {lead.source.utm_source && <span>from {lead.source.utm_source}</span>}
                  <button className="admin-link-button" type="button" onClick={() => setOpen(open === lead.id ? null : lead.id)} aria-expanded={open === lead.id}>
                    <MessageSquare size={13} /> {noteCount ? `${noteCount} note${noteCount > 1 ? 's' : ''}` : canDelete ? 'Notes & data' : 'Notes'}
                  </button>
                </div>
                {open === lead.id && (
                  <div className="admin-lead__history">
                    {history.map((item, index) => (
                      <p key={index} className={item.type === 'note' ? '' : 'admin-muted'}>
                        <span className="admin-muted">{when(item.created_at)} · </span>
                        {item.type === 'note' ? String(item.data.text ?? '') : `Status: ${STATUS_LABEL[String(item.data.from)] ?? item.data.from ?? '—'} → ${STATUS_LABEL[String(item.data.to)] ?? item.data.to}`}
                      </p>
                    ))}
                    <NoteForm onSave={(text) => saveNote(lead, text)} />
                    {canDelete && (
                      <button className="admin-link-button admin-lead__delete" type="button" onClick={() => void removeLead(lead)}>
                        <Trash2 size={13} /> Delete this customer&apos;s data
                      </button>
                    )}
                  </div>
                )}
              </div>
              <select value={lead.status} onChange={(event) => void changeStatus(lead, event.target.value)} aria-label={`Status for ${lead.name}`}>
                {LEAD_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </article>
          );
        })}
      </div>
    </div>
  );
}
