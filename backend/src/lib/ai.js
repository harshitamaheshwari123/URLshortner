const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function suggestLinkMetadata(destinationUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('AI suggestions are not configured (missing GEMINI_API_KEY)');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const prompt = `You are helping a URL shortener suggest metadata for a link.
Given this destination URL: ${destinationUrl}

Suggest:
1. A short, readable custom alias (3-30 characters, lowercase letters/numbers/hyphens only, no spaces) that hints at what the link is about, based only on the URL's domain and path — do not guess at page content you cannot see.
2. Up to 3 relevant, short, lowercase tags (single words or short phrases) for organizing this link.

Respond with ONLY valid JSON in this exact shape, no other text, no markdown code fences:
{"alias": "your-suggested-alias", "tags": ["tag1", "tag2", "tag3"]}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'low' } },
      }),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    const err = new Error(fetchErr.name === 'AbortError' ? 'AI request timed out after 20s' : fetchErr.message);
    err.code = 'AI_REQUEST_FAILED';
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`AI request failed: ${res.status} ${body}`);
    err.code = 'AI_REQUEST_FAILED';
    throw err;
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  console.log('[ai] gemini finishReason:', candidate?.finishReason, '| raw text:', JSON.stringify(text));
  if (!text) {
    console.error('[ai] full response with no text:', JSON.stringify(data));
    const err = new Error('AI response had no text content');
    err.code = 'AI_BAD_RESPONSE';
    throw err;
  }

  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (parseErr) {
    console.error('[ai] JSON parse failed on raw text:', JSON.stringify(text), '| error:', parseErr.message);
    const err = new Error('Could not parse AI response as JSON');
    err.code = 'AI_BAD_RESPONSE';
    throw err;
  }

  const alias = typeof parsed.alias === 'string'
    ? parsed.alias.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30)
    : null;
  const tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3).map(String) : [];

  return { alias, tags };
}
