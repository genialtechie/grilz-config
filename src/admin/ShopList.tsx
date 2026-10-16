import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Plus } from 'lucide-react';
import { listTenants, STATUS_LABEL, type TenantRow } from './data';

type Row = TenantRow & { leads: number; generations: number };

export function ShopList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listTenants().then(setRows).catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <main className="admin-main">
      <div className="admin-title-row">
        <h1>Shops</h1>
        <Link className="admin-button admin-button--primary" to="/admin/shops/new"><Plus size={16} /> New shop</Link>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {!rows && !error && <p className="admin-muted">Loading shops…</p>}
      {rows && (
        <div className="admin-card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Shop</th><th>Status</th><th>Live config</th><th className="num">Leads this month</th><th className="num">AI photos this month</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/admin/shops/${row.slug}`} className="admin-link"><strong>{row.name}</strong></Link>
                    <small className="admin-muted"> /b/{row.slug}{row.kind !== 'shop' ? ` · ${row.kind}` : ''}</small>
                  </td>
                  <td><span className={`admin-pill admin-pill--${row.status}`}>{STATUS_LABEL[row.status]}</span></td>
                  <td>{row.published_version ? `v${row.published_version}` : '—'}</td>
                  <td className="num">{row.leads}</td>
                  <td className="num">{row.generations}</td>
                  <td>
                    {row.published_version && (
                      <a className="admin-icon-button" href={`/b/${row.slug}`} target="_blank" rel="noreferrer" aria-label={`Open ${row.name}'s builder`}><ExternalLink size={15} /></a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
