
export async function checkUrlSafety(url) {
  const apiKey = process.env.SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    console.warn('[safe-browsing] SAFE_BROWSING_API_KEY not set — skipping check for', url);
    return { safe: true, checked: false };
  }

  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'linksnip', clientVersion: '1.0.0' },
          threatInfo: {
            threatTypes: [
              'MALWARE',
              'SOCIAL_ENGINEERING',
              'UNWANTED_SOFTWARE',
              'POTENTIALLY_HARMFUL_APPLICATION',
            ],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      }
    );

    const data = await res.json();
    const matches = data.matches || [];
    return { safe: matches.length === 0, checked: true, matches };
  } catch (err) {
    console.error('[safe-browsing] check failed, allowing URL through:', err.message);
    return { safe: true, checked: false, error: err.message };
  }
}
