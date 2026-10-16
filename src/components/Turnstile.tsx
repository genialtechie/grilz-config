import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from '../lib/turnstile';

// Cloudflare Turnstile, rendered only when VITE_TURNSTILE_SITE_KEY is set.
// "Managed" mode: most people never see a challenge.

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}


let loading: Promise<TurnstileApi> | null = null;
const loadTurnstile = () => {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')));
    script.onerror = () => {
      loading = null;
      reject(new Error('turnstile failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
};

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const container = useRef<HTMLDivElement | null>(null);
  const callback = useRef(onToken);
  callback.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !container.current) return;
    let widget: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !container.current) return;
        widget = api.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: 'interaction-only',
          callback: (token: string) => callback.current(token),
          'expired-callback': () => callback.current(null),
          'error-callback': () => callback.current(null),
        });
      })
      .catch(() => callback.current(null));
    return () => {
      cancelled = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={container} className="turnstile" />;
}
