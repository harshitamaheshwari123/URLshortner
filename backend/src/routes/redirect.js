import { Router } from 'express';
import { UAParser } from 'ua-parser-js';
import crypto from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

async function lookupGeo(ip) {
  if (!ip || isPrivateIp(ip)) {
    return { country: null, city: null };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,city`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    const data = await res.json();
    if (data.status !== 'success') return { country: null, city: null };
    return { country: data.country || null, city: data.city || null };
  } catch (err) {
    console.error('[geo] lookup failed, continuing without location:', err.message);
    return { country: null, city: null };
  }
}

function isPrivateIp(ip) {
  const cleaned = ip.replace('::ffff:', '');
  return (
    cleaned === '::1' ||
    cleaned === '127.0.0.1' ||
    cleaned.startsWith('10.') ||
    cleaned.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(cleaned)
  );
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

router.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;

  const { data: link, error } = await supabaseAdmin
    .from('links')
    .select('*')
    .eq('short_code', shortCode)
    .maybeSingle();

  if (error) {
    console.error('[redirect] lookup failed:', error.message);
    return res.status(500).send('Something went wrong.');
  }

  if (!link || link.is_disabled) {
    return res.status(404).send(notFoundHtml());
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return res.status(410).send(expiredHtml());
  }

  if (link.max_clicks && link.click_count >= link.max_clicks) {
    return res.status(410).send(expiredHtml());
  }

  logClick(req, link).catch((err) => console.error('[redirect] click log failed:', err.message));

  res.redirect(302, link.destination_url);
});

async function logClick(req, link) {
  const ua = new UAParser(req.headers['user-agent'] || '').getResult();
  const deviceType = ua.device.type || 'desktop';
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const geo = await lookupGeo(ip);

  await Promise.all([
    supabaseAdmin.from('clicks').insert({
      link_id: link.id,
      referrer: req.headers.referer || null,
      user_agent: req.headers['user-agent'] || null,
      device_type: deviceType,
      browser: ua.browser.name || null,
      country: geo.country,
      city: geo.city,
      ip_hash: hashIp(ip),
    }),
    supabaseAdmin
      .from('links')
      .update({ click_count: (link.click_count || 0) + 1 })
      .eq('id', link.id),
  ]);
}

function notFoundHtml() {
  return `<!doctype html><html><head><title>Link not found</title></head>
  <body style="font-family:sans-serif;text-align:center;padding:4rem;">
  <h1>404</h1><p>This LinkSnip link doesn't exist or has been disabled.</p></body></html>`;
}

function expiredHtml() {
  return `<!doctype html><html><head><title>Link expired</title></head>
  <body style="font-family:sans-serif;text-align:center;padding:4rem;">
  <h1>Link expired</h1><p>This link is no longer active.</p></body></html>`;
}

export default router;
