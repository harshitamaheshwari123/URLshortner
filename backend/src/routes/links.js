import { Router } from 'express';
import QRCode from 'qrcode';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import {
  generateUniqueShortCode,
  isValidAlias,
  isAliasAvailable,
  isValidUrl,
} from '../lib/shortcode.js';
import { checkUrlSafety } from '../lib/safeBrowsing.js';

const router = Router();

router.post('/', optionalAuth, async (req, res) => {
  const { destination_url, alias, expires_at, tags, max_clicks } = req.body;

  if (!destination_url || !isValidUrl(destination_url)) {
    return res.status(400).json({ error: 'A valid http(s) destination_url is required' });
  }

  const safety = await checkUrlSafety(destination_url);
  if (!safety.safe) {
    return res.status(422).json({ error: 'This URL was flagged as unsafe by Safe Browsing', matches: safety.matches });
  }

  let short_code;
  let is_custom_alias = false;

  if (alias) {
    if (!req.user) {
      return res.status(401).json({ error: 'Custom aliases require an account (PRD user story 2)' });
    }
    if (!isValidAlias(alias)) {
      return res.status(400).json({ error: 'Alias must be 3-30 chars, alphanumeric and hyphens only' });
    }
    if (!(await isAliasAvailable(alias))) {
      return res.status(409).json({ error: 'That alias is already taken' });
    }
    short_code = alias;
    is_custom_alias = true;
  } else {
    short_code = await generateUniqueShortCode();
  }

  const { data, error } = await supabaseAdmin
    .from('links')
    .insert({
      owner_id: req.user?.id || null,
      short_code,
      destination_url,
      is_custom_alias,
      tags: Array.isArray(tags) ? tags : [],
      expires_at: expires_at || null,
      max_clicks: max_clicks ? Number(max_clicks) : null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const shortUrl = `${process.env.PUBLIC_BASE_URL}/${data.short_code}`;
  res.status(201).json({ ...data, short_url: shortUrl });
});

router.get('/', requireAuth, async (req, res) => {
  const { search, tag, archived, sort = 'created_at', order = 'desc' } = req.query;

  let query = supabaseAdmin
    .from('links')
    .select('*')
    .eq('owner_id', req.user.id);

  if (search) {
    query = query.or(`destination_url.ilike.%${search}%,short_code.ilike.%${search}%`);
  }
  if (tag) {
    query = query.contains('tags', [tag]);
  }
  if (archived !== undefined) {
    query = query.eq('is_archived', archived === 'true');
  }

  const allowedSort = ['created_at', 'click_count', 'short_code', 'expires_at'];
  const sortCol = allowedSort.includes(sort) ? sort : 'created_at';
  query = query.order(sortCol, { ascending: order === 'asc' });

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('links')
    .select('*')
    .eq('id', req.params.id)
    .eq('owner_id', req.user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Link not found' });
  res.json(data);
});

router.patch('/:id', requireAuth, async (req, res) => {
  const { destination_url, expires_at, tags, is_archived, is_disabled, alias, max_clicks } = req.body;
  const updates = {};

  if (destination_url !== undefined) {
    if (!isValidUrl(destination_url)) {
      return res.status(400).json({ error: 'Invalid destination_url' });
    }
    updates.destination_url = destination_url;
  }
  if (expires_at !== undefined) updates.expires_at = expires_at;
  if (max_clicks !== undefined) updates.max_clicks = max_clicks ? Number(max_clicks) : null;
  if (tags !== undefined) updates.tags = tags;
  if (is_archived !== undefined) updates.is_archived = is_archived;
  if (is_disabled !== undefined) updates.is_disabled = is_disabled;

  if (alias !== undefined) {
    if (!isValidAlias(alias)) {
      return res.status(400).json({ error: 'Alias must be 3-30 chars, alphanumeric and hyphens only' });
    }
    const { data: existing } = await supabaseAdmin
      .from('links')
      .select('id')
      .eq('short_code', alias)
      .neq('id', req.params.id)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'That alias is already taken' });
    }
    updates.short_code = alias;
    updates.is_custom_alias = true;
  }

  const { data, error } = await supabaseAdmin
    .from('links')
    .update(updates)
    .eq('id', req.params.id)
    .eq('owner_id', req.user.id)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Link not found or not owned by you' });
  res.json(data);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { error, count } = await supabaseAdmin
    .from('links')
    .delete({ count: 'exact' })
    .eq('id', req.params.id)
    .eq('owner_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  if (!count) return res.status(404).json({ error: 'Link not found or not owned by you' });
  res.status(204).end();
});

router.post('/bulk-archive', requireAuth, async (req, res) => {
  const { ids = [], archived = true } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }

  const { data, error } = await supabaseAdmin
    .from('links')
    .update({ is_archived: archived })
    .in('id', ids)
    .eq('owner_id', req.user.id)
    .select('id');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ updated: data.map((d) => d.id) });
});

router.get('/:id/qrcode', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('links')
    .select('short_code')
    .eq('id', req.params.id)
    .eq('owner_id', req.user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Link not found' });

  const shortUrl = `${process.env.PUBLIC_BASE_URL}/${data.short_code}`;
  const png = await QRCode.toBuffer(shortUrl, { type: 'png', width: 300 });
  res.setHeader('Content-Type', 'image/png');
  res.send(png);
});

export default router;
