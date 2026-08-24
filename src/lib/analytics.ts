import type { CaptureResult } from 'posthog-js';

const INTERNAL_TRAFFIC_KEY = 'magpollo_internal_traffic';
const CAMPAIGN_ATTRIBUTION_KEY = 'magpollo_campaign_attribution';

export const ANALYTICS_VERSION = 'commerce_v2';

type CampaignAttribution = {
  campaign_source: string;
  campaign_medium: string;
  campaign_name: string;
  campaign_content: string;
  campaign_term: string;
  landing_path: string;
};

const emptyAttribution = (landingPath: string): CampaignAttribution => ({
  campaign_source: 'direct',
  campaign_medium: 'none',
  campaign_name: 'none',
  campaign_content: 'none',
  campaign_term: 'none',
  landing_path: landingPath,
});

const readStoredAttribution = (): CampaignAttribution | null => {
  try {
    const value = window.sessionStorage.getItem(CAMPAIGN_ATTRIBUTION_KEY);
    return value ? (JSON.parse(value) as CampaignAttribution) : null;
  } catch {
    return null;
  }
};

const captureCampaignAttribution = (): CampaignAttribution => {
  const url = new URL(window.location.href);
  const hasCampaignParameters = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  ].some((parameter) => url.searchParams.has(parameter));

  if (!hasCampaignParameters) {
    return readStoredAttribution() ?? emptyAttribution(url.pathname);
  }

  const attribution: CampaignAttribution = {
    campaign_source: url.searchParams.get('utm_source') || 'unknown',
    campaign_medium: url.searchParams.get('utm_medium') || 'unknown',
    campaign_name: url.searchParams.get('utm_campaign') || 'unknown',
    campaign_content: url.searchParams.get('utm_content') || 'none',
    campaign_term: url.searchParams.get('utm_term') || 'none',
    landing_path: url.pathname,
  };

  try {
    window.sessionStorage.setItem(
      CAMPAIGN_ATTRIBUTION_KEY,
      JSON.stringify(attribution),
    );
  } catch {
    // Attribution still applies to the current event when storage is unavailable.
  }

  return attribution;
};

const applyInternalTrafficControl = (): boolean => {
  const url = new URL(window.location.href);
  const control = url.searchParams.get('mp_internal');

  try {
    if (control === '1') {
      window.localStorage.setItem(INTERNAL_TRAFFIC_KEY, '1');
    } else if (control === '0') {
      window.localStorage.removeItem(INTERNAL_TRAFFIC_KEY);
    }
  } catch {
    // Development traffic is still excluded even when storage is unavailable.
  }

  if (control !== null) {
    url.searchParams.delete('mp_internal');
    window.history.replaceState(window.history.state, '', url);
  }

  if (import.meta.env.DEV) return true;

  try {
    return window.localStorage.getItem(INTERNAL_TRAFFIC_KEY) === '1';
  } catch {
    return false;
  }
};

export const isInternalTraffic = applyInternalTrafficControl();
const campaignAttribution = captureCampaignAttribution();

export const filterAndEnrichAnalyticsEvent = (
  event: CaptureResult | null,
): CaptureResult | null => {
  if (!event || isInternalTraffic) return null;

  return {
    ...event,
    properties: {
      ...event.properties,
      ...campaignAttribution,
      analytics_version: ANALYTICS_VERSION,
      traffic_type: 'external',
    },
  };
};
