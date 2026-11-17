/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTHOG_PROJECT_TOKEN: string;
  readonly VITE_POSTHOG_HOST: string;
  /** Optional: where "Start your plan" goes until card billing ships (e.g. a Stripe Payment Link). */
  readonly VITE_PLAN_PAYMENT_LINK?: string;
  /** Firebase web app config for shopper phone codes (src/lib/phoneAuth.ts). Without them, dev codes. */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
