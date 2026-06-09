# PEPPOL PDF → XML Converter

AI-driven konverterare som läser PDF-fakturor och genererar PEPPOL BIS Billing 3.0 UBL 2.1 XML.  
Drivs av **Claude Vision** (Anthropic). API-nyckeln hanteras säkert på servern — aldrig i webbläsaren.

---

## Snabbstart — lokalt

```bash
# 1. Klona repot
git clone https://github.com/DITT-ORG/peppol-converter.git
cd peppol-converter

# 2. Installera beroenden
npm install

# 3. Skapa .env med din API-nyckel
cp .env.example .env
# Öppna .env och fyll i ANTHROPIC_API_KEY

# 4. Starta servern
npm start
# → http://localhost:3000
```

---

## Deploy — Render.com (gratis, rekommenderat)

> Render ger en publik HTTPS-URL som kollegor kan öppna direkt i webbläsaren.  
> Gratis tier: 750h/mån, somnar efter 15min inaktivitet (vaknar på nästa request ~30s).

### Steg för steg

**1. Skapa GitHub-repo**
```bash
git init
git add .
git commit -m "Initial commit — PEPPOL converter"
git remote add origin https://github.com/DITT-ORG/peppol-converter.git
git push -u origin main
```

**2. Skapa Web Service på Render**
- Gå till [render.com](https://render.com) → Sign up (gratis)
- Klicka **New +** → **Web Service**
- Koppla ditt GitHub-konto och välj repot
- Fyll i:

| Inställning | Värde |
|---|---|
| Name | `peppol-converter` |
| Region | `Frankfurt (EU Central)` |
| Branch | `main` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | `Free` |

**3. Lägg till API-nyckel som miljövariabel**
- Gå till din service → **Environment**
- Klicka **Add Environment Variable**
- Key: `ANTHROPIC_API_KEY`
- Value: din nyckel (börjar med `sk-ant-`)
- Klicka **Save Changes** → Render deployer om automatiskt

**4. Dela länken**
- Din app är live på: `https://peppol-converter.onrender.com`
- Dela länken med kollegor — de behöver ingen egen API-nyckel

---

## Deploy — Docker (intern server / on-prem)

```bash
# Bygg imagen
docker build -t peppol-converter .

# Kör med din API-nyckel
docker run -d \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-xxx \
  --name peppol-converter \
  peppol-converter

# Verifiera att den kör
curl http://localhost:3000/health
```

För att köra bakom Nginx eller intern reverse proxy, sätt rätt port.

---

## Projektstruktur

```
peppol-converter/
├── server.js          # Express-server + Claude API-proxy
├── package.json
├── Dockerfile
├── .env.example       # Mall för lokal .env (kopiera, fyll i nyckel)
├── .gitignore         # .env och node_modules ignoreras
└── public/
    └── index.html     # Hela frontend-appen (single-file HTML)
```

## Säkerhet

- API-nyckeln läggs **aldrig** i koden eller i HTML-filen
- Nyckeln sätts som miljövariabel på servern
- Frontenden anropar `/api/claude` (din server) — inte Anthropic direkt
- `.env` är med i `.gitignore` — kan inte råka commitas

## Hur det fungerar

```
1. Användare laddar upp PDF/PNG/JPG
2. Webbläsaren skickar base64-data till /api/claude (din server)
3. Servern lägger till API-nyckeln och vidarebefordrar till Anthropic
4. Claude Vision analyserar fakturan och returnerar strukturerat JSON
5. Frontend bygger PEPPOL UBL 2.1 XML från JSON-data
6. Användaren laddar ner färdig XML-faktura
```

## API-endpoints

| Endpoint | Metod | Beskrivning |
|---|---|---|
| `/` | GET | Serverar appen |
| `/api/claude` | POST | Proxar anrop till Claude API |
| `/health` | GET | Statuskontroll (API-nyckel satt?) |

---

Gjord med ❤️ för PEPPOL BIS Billing 3.0 testning
