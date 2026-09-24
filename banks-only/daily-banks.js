const http = require('../lib/http');
const cliProgress = require('cli-progress');
const { uploadToGoogleSheets } = require('./googleSheetsBanks');
const companies = require('../data/companies.json');

const PRICES_URL = 'https://www.dsebd.org/api/live/prices';

function cell(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function priceChange(ltp, ycp, percent) {
  if (percent === null || percent === undefined || !ltp) return '';
  return String(Math.round((ltp - ycp) * 100) / 100);
}

async function scrapeDailyPrices() {
  try {
    const codes = new Set(
      companies.filter((company) => company.sector === 'Bank').map((company) => company.tradingCode)
    );

    const { data } = await http.get(PRICES_URL);
    const cols = data.cols;
    const rows = data.rows || [];
    const index = Object.fromEntries(cols.map((name, i) => [name, i]));

    if (rows.length === 0) {
      console.error('No price rows found for Bank');
      return;
    }

    const progressBar = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% || {value}/{total} Stocks',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    progressBar.start(rows.length, 0);

    const stocks = [];
    rows.forEach((row, i) => {
      const symbol = row[index.code];
      if (codes.has(symbol)) {
        const ltp = row[index.ltp];
        const ycp = row[index.ycp];
        stocks.push({
          Date: new Date().toISOString().slice(0, 10),
          Symbol: symbol,
          YCP: cell(ycp),
          LTP: cell(ltp),
          CP: cell(row[index.close]),
          Low: cell(row[index.low]),
          High: cell(row[index.high]),
          Change: priceChange(ltp, ycp, row[index.percent]),
          Volume: cell(row[index.volume]),
        });
      }
      progressBar.update(i + 1);
    });

    progressBar.stop();

    if (stocks.length === 0) {
      console.warn('No valid stock data parsed for Bank');
      return;
    }

    console.log(`Parsed ${stocks.length} daily records for Bank`);

    await uploadToGoogleSheets(stocks, { isDaily: true });

    console.log(`Added ${stocks.length} daily records to Bank`);
  } catch (error) {
    console.error('Daily scrape error for Bank:', error.message);
  }
}

const group = process.argv[2];

if (group === 'Bank') {
  scrapeDailyPrices();
} else {
  console.log('Usage: node scraper-daily-banks.js Bank');
}
