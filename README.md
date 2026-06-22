# DSE Stock Scraper

Automated scraper for the [Dhaka Stock Exchange (DSE)](https://www.dsebd.org/) that collects share price data, company fundamentals, bank-sector listings, and RSI indicators — then uploads results to Google Sheets.

## Features

- **Daily scrape** — latest prices for Category A, Category B, and Bank stocks
- **Full scrape** — daily prices plus company details (sector, 52-week range, NAV, EPS, dividend, AGM, etc.)
- **RSI analysis** — 1-year price history with 1Y, 1M, and 14-day RSI calculations
- **Google Sheets sync** — writes directly to configured spreadsheets
- **GitHub Actions** — scheduled daily runs in the cloud

## Requirements

- [Node.js](https://nodejs.org/) 20+ (24 recommended)
- npm
- Google Cloud service account with Sheets API enabled
- Google Sheet shared with the service account email

## Installation

```bash
git clone https://github.com/skmohotasin/DSE.git
cd DSE
npm install
```

## Google Sheets Setup

### 1. Create a service account

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Create a **Service account** (e.g. `DSE-Scraper`)
3. Enable the **Google Sheets API** for the project
4. Go to the service account → **Keys** → **Add key** → **Create new key** → **JSON**
5. Save the downloaded file as `credentials.json` in the project root

### 2. Share your spreadsheet

Share the target Google Sheet with the service account email (found in `client_email` inside `credentials.json`) as **Editor**.

### 3. Configure spreadsheet IDs

Spreadsheet IDs are set in:

| File | Purpose |
|------|---------|
| `all-data/googleSheets.js` | Category A & B daily/full data |
| `banks-only/googleSheetsBanks.js` | Bank stocks |
| `RSI/Price-1Y.js` | RSI & price history sheets |

### Google Sheet tabs

Scripts create these tabs automatically if they don't exist:

| Tab name | Script |
|----------|--------|
| `Category A` | `DailyCatA`, `FullCatA` |
| `Category B` | `DailyCatB`, `FullCatB` |
| `Type Bank` | `DailyBank`, `FullBank` |
| RSI tabs | `RSI` scripts (from Excel upload) |

## Usage

### Daily scrapes

```bash
npm run DailyCatA      # Category A prices only
npm run DailyCatB      # Category B prices only
npm run DailyBank      # Bank sector prices only
npm run DailyAll       # All three in parallel
```

### Full scrapes (prices + company details)

```bash
npm run FullCatA       # Category A full data
npm run FullCatB       # Category B full data
npm run FullBank       # Bank full data
npm run FullAll        # All three in parallel
```

### Run everything

```bash
npm run all            # DailyAll + FullAll in parallel
```

### RSI

```bash
npm run RSI            # Fetch 1Y prices, then calculate all RSI sheets
```

Or run individual steps:

```bash
npm run FullRSI        # Download 1-year price history
npm run CalRSIY        # Calculate 1-year RSI
npm run CalRSIM        # Calculate 30-day RSI
npm run CalRSIC14      # Calculate 14-day RSI
```

## GitHub Actions

The workflow in `.github/workflows/run-dse.yml` runs `DailyAll` automatically:

- **Schedule:** every day at 9:00 AM UTC (3:00 PM Dhaka time)
- **Manual trigger:** Actions tab → **Run DailyAll DSE Scripts** → **Run workflow**

### Required secret

Add a repository secret named `GOOGLE_CREDENTIALS` containing the base64-encoded `credentials.json`:

**PowerShell:**

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("credentials.json"))
```

**Linux / macOS:**

```bash
base64 -w 0 credentials.json
```

Paste the output into **GitHub → Settings → Secrets and variables → Actions → New repository secret**.

## Project Structure

```
DSE/
├── all-data/
│   ├── daily.js           # Daily scrape for Category A/B
│   ├── full.js            # Full scrape with company details
│   └── googleSheets.js    # Google Sheets upload (Category A/B)
├── banks-only/
│   ├── daily-banks.js     # Daily bank sector scrape
│   ├── full-banks.js      # Full bank scrape
│   └── googleSheetsBanks.js
├── RSI/
│   ├── Price-1Y.js        # 1-year price history fetcher
│   ├── calculateRSI_1Y.js # 1-year RSI calculator
│   ├── calculateRSI_1M.js # 30-day RSI calculator
│   ├── calculateRSI_1C.js # Custom-period RSI calculator
│   ├── RSIUtils.js
│   └── googleSheetsRSI1Y.js
├── lib/
│   └── http.js            # Shared HTTP client (TLS handling for dsebd.org)
├── scripts/
│   └── run.js             # Node script runner
├── .github/workflows/
│   └── run-dse.yml        # Scheduled CI workflow
├── credentials.json       # Google service account key (not committed)
└── package.json
```

## Troubleshooting

### TLS / certificate errors

`dsebd.org` serves an incomplete TLS certificate chain. All scrapers use `lib/http.js`, which handles this automatically. If you see certificate errors, make sure you're running the npm scripts (not calling `node` on scraper files directly without the project setup).

### `credentials.json` not found

Place your Google service account JSON at the project root as `credentials.json`, or set:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

### Google Sheets permission denied

Confirm the spreadsheet is shared with your service account email as **Editor**.

### GitHub Actions fails on credentials

Verify the `GOOGLE_CREDENTIALS` secret is valid base64 of the full `credentials.json` file.

## License

ISC
