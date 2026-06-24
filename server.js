require('dotenv').config();
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Basic Auth middleware ────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path === '/health') return next();

  const expectedUser = process.env.APP_USER;
  const expectedPass = process.env.APP_PASS;

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

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '25mb' }));
app.use(express.text({ type: 'application/xml', limit: '10mb' }));

// ─── Static files from /public ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Claude API proxy ─────────────────────────────────────────────────────────
app.options('/api/claude', (_req, res) => res.sendStatus(200));

app.post('/api/claude', async (req, res) => {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  console.log("[debug] apiKey length:", apiKey.length, "first 15:", apiKey.substring(0,15));

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
    console.error('[claude proxy error]', err.message);
    res.status(502).json({ error: 'Upstream request failed', detail: err.message });
  }
});

// ─── PEPPOL Validator proxy ───────────────────────────────────────────────────
app.post('/api/validate', async (req, res) => {
  try {
    const xmlBody = req.body;

    if (!xmlBody || typeof xmlBody !== 'string') {
      console.error('[validate] Ingen XML-body mottagen. Content-Type:', req.headers['content-type']);
      return res.status(400).json({ error: 'XML body saknas', contentType: req.headers['content-type'] });
    }

    console.log(`[validate] Mottog ${xmlBody.length} bytes XML`);

    const boundary = '----PeppolBoundary' + Date.now();
    const xmlBuffer = Buffer.from(xmlBody, 'utf8');

    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="invoice.xml"\r\nContent-Type: application/xml\r\n\r\n`,
      'utf8'
    );
    const footer = Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\ninvoice\r\n--${boundary}--\r\n`, 'utf8');
    const body   = Buffer.concat([header, xmlBuffer, footer]);

    console.log(`[validate] Skickar ${body.length} bytes till EU-validator`);

    const upstream = await fetch(
      'https://www.itb.ec.europa.eu/invoice/api/validate',
      {
        method:  'POST',
        headers: {
          'Content-Type':   `multipart/form-data; boundary=${boundary}`,
          'Accept':         'application/json',
        },
        body,
        signal: AbortSignal.timeout(15000),
      }
    );

    console.log(`[validate] EU svarade: HTTP ${upstream.status}`);

    const text = await upstream.text();
    console.log(`[validate] Svar (första 300 bytes):`, text.substring(0, 300));

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'EU-validatorn svarade med fel',
        status: upstream.status,
        detail: text.substring(0, 500),
      });
    }

    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch {
      res.status(502).json({ error: 'EU-validatorn returnerade icke-JSON', raw: text.substring(0, 500) });
    }

  } catch (err) {
    console.error('[validate proxy error]', err.message);
    res.status(502).json({ error: 'Kunde inte nå EU-validatorn', detail: err.message });
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
  console.log(`    Endpoints: /api/claude  /api/validate  /health`);
});