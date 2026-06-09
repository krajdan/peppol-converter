const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Body parsing (base64 PDFs can be large) ─────────────────────────────────
app.use(express.json({ limit: '25mb' }));

// ─── Static files from /public ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Claude API proxy ─────────────────────────────────────────────────────────
// Handles both the OPTIONS preflight and the actual POST.
// The API key lives only here — never sent to the browser.
app.options('/api/claude', (_req, res) => {
  res.sendStatus(200);
});

app.post('/api/claude', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not configured on the server.'
    });
  }

  try {
    // Node 18+ has fetch built-in — no extra packages needed
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);

  } catch (err) {
    console.error('[proxy error]', err.message);
    res.status(502).json({ error: 'Upstream request failed', detail: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'PEPPOL PDF Converter',
    node:      process.version,
    apiKeySet: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅  PEPPOL Converter  →  http://localhost:${PORT}`);
  console.log(`    Node ${process.version}`);
  console.log(`    API key: ${process.env.ANTHROPIC_API_KEY ? '✓ set' : '✗ MISSING'}`);
});
