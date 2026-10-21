export const campaignKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
];
export const preferenceKey = "pretalk.preferences.v1";
export const campaignKey = "pretalk.campaign.v1";

export function campaignFromSearch(search) {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    campaignKeys.flatMap((key) => {
      const value = params
        .get(key)
        ?.trim()
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .slice(0, 120);
      return value ? [[key, value]] : [];
    }),
  );
}

export function readPreferences(storage) {
  try {
    const value = JSON.parse(storage.getItem(preferenceKey));
    return value?.version === 1 && typeof value.campaignTracking === "boolean"
      ? { version: 1, campaignTracking: value.campaignTracking }
      : null;
  } catch {
    return null;
  }
}

export function savePreferences(storage, allowed) {
  const preferences = { version: 1, campaignTracking: !!allowed };
  try {
    storage.setItem(preferenceKey, JSON.stringify(preferences));
  } catch {
    /* Preferences remain usable when storage is disabled. */
  }
  return preferences;
}

export function captureCampaign(
  search,
  allowed,
  storage,
  now = new Date().toISOString(),
) {
  try {
    if (!allowed) {
      storage.removeItem(campaignKey);
      return null;
    }
    const existing = storage.getItem(campaignKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed && typeof parsed.capturedAt === "string" && parsed.parameters)
        return parsed;
    }
    const parameters = campaignFromSearch(search);
    if (!Object.keys(parameters).length) return null;
    const attribution = { capturedAt: now, parameters };
    storage.setItem(campaignKey, JSON.stringify(attribution));
    return attribution;
  } catch {
    return null;
  }
}
