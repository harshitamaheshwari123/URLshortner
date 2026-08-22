import { supabaseAdmin } from './supabase.js';

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ALIAS_RE = /^[a-zA-Z0-9-]{3,30}$/;

function randomBase62(length = 7) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += BASE62[Math.floor(Math.random() * BASE62.length)];
  }
  return out;
}

export async function generateUniqueShortCode(length = 7, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = randomBase62(length);
    const { data, error } = await supabaseAdmin
      .from('links')
      .select('id')
      .eq('short_code', candidate)
      .maybeSingle();

    if (error) throw error;
    if (!data) return candidate;
  }
  throw new Error('Could not generate a unique short code, try again');
}

export function isValidAlias(alias) {
  return ALIAS_RE.test(alias);
}

export async function isAliasAvailable(alias) {
  const { data, error } = await supabaseAdmin
    .from('links')
    .select('id')
    .eq('short_code', alias)
    .maybeSingle();
  if (error) throw error;
  return !data;
}

export function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
