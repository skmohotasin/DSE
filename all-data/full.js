const http = require('../lib/http');
const cliProgress = require('cli-progress');
const { uploadToGoogleSheets } = require('./googleSheets');
const companies = require('../data/companies.json');

const PRICES_URL = 'https://www.dsebd.org/api/live/prices';

function cell(value) {
  if (value === null || value === undefined || value === '$undefined') return '';
  return String(value);
}

function priceChange(ltp, ycp, percent) {
  if (percent === null || percent === undefined || !ltp) return '';
  return String(Math.round((ltp - ycp) * 100) / 100);
}

function formatDividend(history) {
  if (!Array.isArray(history) || history.length === 0) return '';
  const latest = [...history].sort((a, b) => b.year - a.year)[0];
  const parts = [];
  if (latest.cash) parts.push(`${latest.cash}%C`);
  if (latest.stock) parts.push(`${latest.stock}%B`);
  if (latest.rights) parts.push(`${latest.rights}%R`);
  return parts.join(', ') || '0';
}

function extractCompany(html) {
  const marker = '\\"company\\":';
  const start = html.indexOf(marker);
  if (start < 0) return null;

  let i = start + marker.length;
  if (html[i] !== '{') return null;

  let depth = 0;
  let out = '';
  let inString = false;
  for (; i < html.length; i++) {
    const ch = html[i];
    out += ch;
    if (ch === '\\') {
      out += html[++i] || '';
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    }
  }

  return JSON.parse(out.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
}

async function scrapeCompanyDetails(symbol) {
  try {
    const { data } = await http.get(`https://www.dsebd.org/company/${encodeURIComponent(symbol)}`);
    const company = extractCompany(data);
    if (!company) return null;

    const rangeLow = company.weekLow52;
    const rangeHigh = company.weekHigh52;
    const range = Number(rangeHigh) - Number(rangeLow);

    return {
      CompanyName: company.name || '',
      Range52Wk: {
        lowest: cell(rangeLow),
        highest: cell(rangeHigh),
        range: Number.isFinite(range) ? range : '',
      },
      NAV: cell(company.nav),
      EPS: cell(company.eps),
      Dividend: formatDividend(company.dividendHistory),
      LastAGM: cell(company.agmDate),
    };
  } catch (err) {
    console.warn(`Could not fetch company details for ${symbol}: ${err.message}`);
    return null;
  }
}

async function scrapeCategory(group) {
  try {
    const byCode = new Map(
      companies
        .filter((company) => company.category === group)
        .map((company) => [company.tradingCode, company])
    );

    const { data } = await http.get(PRICES_URL);
    const cols = data.cols;
    const index = Object.fromEntries(cols.map((name, i) => [name, i]));
    const priceRows = (data.rows || []).filter((row) => byCode.has(row[index.code]));

    console.log(`Found ${priceRows.length} rows for group ${group}`);

    if (priceRows.length === 0) {
      console.error(`No data rows found for group ${group}`);
      return;
    }

    const stocks = [];
    const progressBar = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% || {value}/{total} Companies',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    progressBar.start(priceRows.length, 0);

    for (let i = 0; i < priceRows.length; i++) {
      const row = priceRows[i];
      const symbol = row[index.code];
      const saved = byCode.get(symbol);
      const extra = await scrapeCompanyDetails(symbol);
      const ltp = Number(row[index.ltp]) || 0;
      const ycp = row[index.ycp];
      const lowest52 = Number(extra?.Range52Wk?.lowest) || 1;
      const Last1YGain = ((ltp - lowest52) / lowest52 * 100).toFixed(2) + '%';

      stocks.push({
        Date: new Date().toISOString().slice(0, 10),
        Symbol: symbol,
        YCP: cell(ycp),
        LTP: cell(row[index.ltp]),
        CP: cell(row[index.close]),
        Low: cell(row[index.low]),
        High: cell(row[index.high]),
        Change: priceChange(row[index.ltp], ycp, row[index.percent]),
        Volume: cell(row[index.volume]),
        CompanyName: extra?.CompanyName || '',
        Sector: saved?.sector || '',
        Lowest: extra?.Range52Wk?.lowest || '',
        Highest: extra?.Range52Wk?.highest || '',
        Range52Wk: extra?.Range52Wk?.range ?? '',
        NAV: extra?.NAV || '',
        EPS: extra?.EPS || '',
        Dividend: extra?.Dividend || '',
        LastAGM: extra?.LastAGM || '',
        Last1YGain,
      });

      progressBar.update(i + 1);
    }

    progressBar.stop();

    console.log(`Parsed ${stocks.length} stock entries`);

    if (stocks.length === 0) {
      console.error('No valid stock data parsed. The page structure may have changed.');
      return;
    }

    await uploadToGoogleSheets(stocks, {
      group,
      isDaily: false
    });

    console.log(`Updated Category ${group} with ${stocks.length} records`);
  } catch (error) {
    console.error(`Category ${group} Error:`, error.message);
  }
}

if (require.main === module) {
  const group = process.argv[2]?.toUpperCase() || 'A';
  if (['A', 'B'].includes(group)) {
    scrapeCategory(group);
  } else {
    console.log('Usage: node scraper-full.js [A|B]');
  }
}

module.exports = { scrapeCompanyDetails };
