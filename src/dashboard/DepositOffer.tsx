import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { MyShop } from '../admin/data';
import { supabase } from '../admin/supabase';
import { loadShopConfig } from './shopConfig';

// Deposits start off (MAG-91). Once design requests come in, Leads offers
// them to the owner, until they set one up or close the card.

const KEY = (shopId: string) => `vvs-deposit-offer:${shopId}`;
const dismissed = (shopId: string) => {
  try {
    return localStorage.getItem(KEY(shopId)) === '1';
  } catch {
    return false;
  }
};

export function DepositOffer({ shop }: { shop: MyShop }) {
  const [show, setShow] = useState(false);
  const owner = shop.role !== 'staff';

  useEffect(() => {
    if (!owner || dismissed(shop.id)) return;
    let cancelled = false;
    void Promise.all([
      loadShopConfig(shop.slug),
      supabase().from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', shop.id),
    ]).then(([loaded, leads]) => {
      if (!cancelled) setShow(loaded?.config.deposit.mode === 'none' && (leads.count ?? 0) > 0);
    });
    return () => {
      cancelled = true;
    };
  }, [owner, shop.id, shop.slug]);

  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY(shop.id), '1');
    } catch {
      // Private browsing: it just comes back next time.
    }
    setShow(false);
  };

  return (
    <section className="admin-card dash-offer">
      <p>Take a deposit on orders like this? <Link to={`/dashboard/${shop.slug}/shop?advanced=1#deposit`}>Set it up in 2 minutes</Link></p>
      <button className="admin-icon-button" type="button" onClick={close} aria-label="Not now"><X size={16} /></button>
    </section>
  );
}
