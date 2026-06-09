const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Basic Auth middleware ────────────────────────────────────────────────────
app.use((req, res, next) => {
  // Health check bypasses auth so Render can monitor the service
  if (req.path === '/health') return next();

  const expectedUser = process.env.APP_USER;
  const expectedPass = process.env.APP_PASS;

  // If no credentials configured, skip auth (local dev)
  if (!expectedUser || !expectedPass) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="PEPPOL Converter"');
    return res.status(401).send('Inloggning krävs');
  }

  const base64 = authHeader.slice(6);
  const decoded = Buffer.from(base64, 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');

  if (user === expectedUser && pass === expectedPass) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="PEPPOL Converter"');
  return res.status(401).send('Fel användarnamn eller lösenord');
});

// ─── Body parsing (base64 PDFs can be large) ─────────────────────────────────
app.use(express.json({ limit: '25mb' }));

// ─── Static files from /public ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Claude API proxy ─────────────────────────────────────────────────────────
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

// ─── Health check (no auth) ───────────────────────────────────────────────────
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
  console.log(`    Auth:    ${process.env.APP_USER ? '✓ aktiv' : '✗ avstängd (lokal dev)'}`);
});
