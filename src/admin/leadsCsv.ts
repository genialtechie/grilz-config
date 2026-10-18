import { displayContact } from '../lib/contact';
import type { LeadEvent, LeadRow } from './data';

// Lead statuses and the CSV export, shared by the admin and the shop dashboard.

type Lead = LeadRow;

export const LEAD_STATUSES = [
  ['new', 'New'],
  ['contacted', 'Contacted'],
  ['deposit_paid', 'Deposit paid'],
  ['won', 'Won'],
  ['lost', 'Lost'],
] as const;
export const STATUS_LABEL = Object.fromEntries(LEAD_STATUSES) as Record<string, string>;


/** Quotes a CSV cell, and defuses values a spreadsheet would run as a formula. */
export const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export function leadsCsv(leads: Lead[], notes: LeadEvent[]) {
  const header = ['Date', 'Name', 'Contact', 'Email', 'Design', 'Total', 'Deposit', 'Status', 'Customer note', 'Shop notes', 'Source'];
  const rows = leads.map((lead) => [
    new Date(lead.created_at).toISOString(),
    lead.name,
    displayContact(lead.contact),
    lead.email ?? '',
    (lead.spec.summary ?? []).join(' · '),
    lead.total,
    lead.deposit ?? '',
    STATUS_LABEL[lead.status] ?? lead.status,
    lead.note ?? '',
    notes.filter((item) => item.lead_id === lead.id && item.type === 'note').map((item) => String(item.data.text ?? '')).join(' | '),
    lead.source.utm_source ?? '',
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

