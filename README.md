# PEPPOL PDF → XML Converter

AI-driven konverterare som läser PDF-fakturor och genererar PEPPOL BIS Billing 3.0 UBL 2.1 XML.
Drivs av **Claude Vision** (Anthropic). API-nyckeln hanteras säkert på servern — aldrig i webbläsaren.

---

## Systemöversikt

```
┌─────────────────────────────────────────────────────────────────┐
│                        PEPPOL-flödet                            │
│                                                                 │
│  PDF-faktura                                                    │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────┐     /api/claude      ┌──────────────────┐     │
│  │  Webbläsare  │ ──────────────────▶ │   server.js      │     │
│  │  (frontend)  │                     │   (Node/Express) │     │
│  │              │ ◀────────────────── │                  │     │
│  └─────────────┘     JSON-svar        └────────┬─────────┘     │
│                                                │               │
│                                                │ x-api-key     │
│                                                ▼               │
│                                       ┌──────────────────┐     │
│                                       │  Anthropic API   │     │
│                                       │  Claude Vision   │     │
│                                       └──────────────────┘     │
│                                                                 │
│  Resultat: PEPPOL BIS 3.0 UBL 2.1 XML                         │
└─────────────────────────────────────────────────────────────────┘
```

### Säkerhetsmodell

```
GitHub repo          Render.com           Webbläsaren
─────────────        ──────────────       ────────────────
server.js      →     Environment var  →   /api/claude
package.json         ANTHROPIC_API_KEY    (ingen nyckel
public/              (krypterad)          syns här)
README.md
Dockerfile
.env.example
─────────────
.env          ←── gitignore, når aldrig GitHub
```

---

## PEPPOL BIS 3.0 — fält som stöds

### Parter
| BT | Fält | Beskrivning |
|---|---|---|
| BT-27 | Säljarens namn | AccountingSupplierParty |
| BT-30 | Säljarens org.nr | schemeID 0007 (Sverige) |
| BT-31 | Säljarens VAT-nr | SE + 12 siffror |
| BT-34 | Säljarens endpoint | PEPPOL-ID för routing |
| BT-44 | Köparens namn | AccountingCustomerParty |
| BT-47 | Köparens org.nr | |
| BT-48 | Köparens VAT-nr | |
| BT-49 | Köparens endpoint | PEPPOL-ID för routing |
| BT-59 | Betalningsmottagare | Factoringbolag (Payee BG-10) |
| BT-60 | Betalningsmottagarens ID | Factoringens org.nr |

### Dokument
| BT | Fält | Beskrivning |
|---|---|---|
| BT-1 | Fakturanummer | |
| BT-2 | Fakturadatum | YYYY-MM-DD |
| BT-3 | Fakturatyp | 380=faktura, 381=kreditnota |
| BT-5 | Valuta | ISO 4217 (SEK, EUR...) |
| BT-9 | Förfallodatum | |
| BT-10 | Köparreferens | Beställarreferens — obligatorisk i Sverige |
| BT-12 | Kontraktsnummer | Valfri |
| BT-13 | Ordernummer | Valfri |
| BT-22 | Anteckning | Fritext |

### Betalning
| BT | Fält | Beskrivning |
|---|---|---|
| BT-81 | Betalningssätt | 30=kreditöverföring |
| BT-83 | OCR / Betalningsref | |
| BT-84 | Bankgiro / IBAN | Betalningsmottagarens konto |
| BT-85 | Kontonamn | |

### Moms
| BT | Fält | Beskrivning |
|---|---|---|
| BT-118 | Momskategori | S=standard, AE=omvänd, K=EU, G=export, E=undantagen |
| BT-119 | Momssats % | 25 / 12 / 6 / 0 |
| BT-120 | Undantagstext | Krävs vid AE, K, G, E |

### Summor
| BT | Fält | Beskrivning |
|---|---|---|
| BT-106 | Netto (summa rader) | Exkl. moms |
| BT-110 | Momsbelopp | |
| BT-112 | Totalt inkl. moms | |
| BT-114 | Avrundning | PayableRoundingAmount |
| BT-115 | Att betala | Inkl. eventuell avrundning |

### Fakturarader
| BT | Fält | Beskrivning |
|---|---|---|
| BT-129 | Antal | Med enhetskod (HUR, EA, DAY...) |
| BT-146 | À-pris | **Alltid exkl. moms** (EN 16931) |
| BT-153 | Beskrivning | |
| BT-155 | Artikelnummer | Säljarens ID |

---

## Factoringbolag

Fakturan fakturerar köparen som vanligt men betalningen styrs till
factoringbolaget via Payee-blocket (BG-10):

```xml
<cac:PayeeParty>
  <cac:PartyName>
    <cbc:Name>Svea Ekonomi AB</cbc:Name>       <!-- BT-59 -->
  </cac:PartyName>
  <cac:PartyLegalEntity>
    <cbc:CompanyID>5561234567</cbc:CompanyID>   <!-- BT-60 -->
  </cac:PartyLegalEntity>
</cac:PayeeParty>

<cac:PaymentMeans>
  <cac:PayeeFinancialAccount>
    <cbc:ID>5555-1234</cbc:ID>                 <!-- BT-84: factoringens bankgiro -->
    <cbc:Name>Svea Ekonomi AB</cbc:Name>        <!-- BT-85 -->
  </cac:PayeeFinancialAccount>
</cac:PaymentMeans>
```

---

## Avrundning (BT-114)

```
Netto:                  9 877,74 SEK
Moms 25%:               2 469,43 SEK
Totalt inkl. moms:     12 347,17 SEK
Avrundning (BT-114):       -0,17 SEK   ← PayableRoundingAmount
Att betala (BT-115):   12 347,00 SEK
```

---

## Deployment

### Lokalt

```bash
unzip peppol-converter.zip
cd peppol-converter
cp .env.example .env        # fyll i ANTHROPIC_API_KEY
npm install
npm start                   # → http://localhost:3000
```

### Render.com (rekommenderat för team)

1. Pusha till GitHub
2. render.com → New → Web Service → koppla repo
3. Build: `npm install` · Start: `npm start`
4. Environment → `ANTHROPIC_API_KEY` = din nyckel
5. Dela URL:en med kollegor — ingen nyckel behövs på klientsidan

### Docker (intern server)

```bash
docker build -t peppol-converter .
docker run -d -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-xxx \
  peppol-converter
```

---

## Projektstruktur

```
peppol-converter/
├── server.js                  # Express + Claude API-proxy
├── package.json               # Endast express som beroende
├── Dockerfile                 # Docker/on-prem deploy
├── .env.example               # Mall — kopiera till .env
├── .gitignore                 # .env och node_modules ignoreras
├── README.md                  # Denna fil
└── public/
    ├── index.html             # Hela frontend-appen (single-file)
    ├── testfaktura-1.pdf      # Komplett testfaktura
    └── testfaktura-2.pdf      # Testfaktura med avrundning BT-114
```

---

## API-endpoints

| Endpoint | Metod | Beskrivning |
|---|---|---|
| `/` | GET | Serverar appen |
| `/api/claude` | POST | Proxar till Claude API (lägger till API-nyckel) |
| `/health` | GET | Status — kontrollerar att nyckeln är satt |

---

*PEPPOL BIS Billing 3.0 · EN 16931 · UBL 2.1*
