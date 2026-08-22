import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { suggestLinkMetadata } from '../lib/ai.js';
import { isValidUrl } from '../lib/shortcode.js';

const router = Router();

router.post('/suggest-metadata', requireAuth, async (req, res) => {
  const { destination_url } = req.body;

  if (!destination_url || !isValidUrl(destination_url)) {
    return res.status(400).json({ error: 'A valid http(s) destination_url is required' });
  }

  try {
    const suggestion = await suggestLinkMetadata(destination_url);
    res.json(suggestion);
  } catch (err) {
    if (err.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ error: err.message });
    }
    console.error('[ai] suggestion failed:', err.message);
    const isBusy = err.message.includes('503') || err.message.includes('UNAVAILABLE') || err.message.includes('timed out');
    const friendlyMessage = isBusy
      ? 'AI is busy right now (Google\'s servers are overloaded) — try again in a moment, or fill it in manually'
      : 'AI suggestion failed, try again or fill it in manually';
    res.status(502).json({ error: friendlyMessage });
  }
});

export default router;
