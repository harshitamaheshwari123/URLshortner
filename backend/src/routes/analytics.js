import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

async function assertOwnership(linkId, userId) {
  const { data } = await supabaseAdmin
    .from('links')
    .select('id')
    .eq('id', linkId)
    .eq('owner_id', userId)
    .maybeSingle();
  return !!data;
}

router.get('/:linkId', requireAuth, async (req, res) => {
  if (!(await assertOwnership(req.params.linkId, req.user.id))) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const { data: clicks, error } = await supabaseAdmin
    .from('clicks')
    .select('*')
    .eq('link_id', req.params.linkId)
    .order('clicked_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    total_clicks: clicks.length,
    clicks_over_time: bucketByDay(clicks),
    top_referrers: topCounts(clicks, 'referrer'),
    device_breakdown: topCounts(clicks, 'device_type'),
    browser_breakdown: topCounts(clicks, 'browser'),
    geo_breakdown: topCounts(clicks, 'country'),
    raw: clicks,
  });
});

router.get('/:linkId/export.csv', requireAuth, async (req, res) => {
  if (!(await assertOwnership(req.params.linkId, req.user.id))) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const { data: clicks, error } = await supabaseAdmin
    .from('clicks')
    .select('clicked_at,referrer,device_type,browser,country,city')
    .eq('link_id', req.params.linkId)
    .order('clicked_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const header = 'clicked_at,referrer,device_type,browser,country,city\n';
  const rows = clicks
    .map((c) =>
      [c.clicked_at, c.referrer, c.device_type, c.browser, c.country, c.city]
        .map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="link-${req.params.linkId}-clicks.csv"`);
  res.send(header + rows);
});

function bucketByDay(clicks) {
  const buckets = {};
  for (const c of clicks) {
    const day = c.clicked_at.slice(0, 10);
    buckets[day] = (buckets[day] || 0) + 1;
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }));
}

function topCounts(clicks, field) {
  const counts = {};
  for (const c of clicks) {
    const key = c[field] || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export default router;
