const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');
const { uploadAllCategoriesToGoogleSheets } = require('./googleSheetsTradingCode');

async function tradingCode(group) {
  const url =
    group === 'BANK'
      ? 'https://www.dsebd.org/ltp_industry.php?area=11'
      : `https://dsebd.org/latest_share_price_scroll_group.php?group=${group}`;

  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  });

  const $ = cheerio.load(data);
  const stocks = [];
  const rows = $('.table.table-bordered tr');

  if (rows.length <= 1) {
    console.error(`❌ No data rows found for group ${group}`);
    return [];
  }

  const dataRows = rows.slice(1).toArray();
  const progressBar = new cliProgress.SingleBar({
    format: `Progress [${group}] |{bar}| {percentage}% || {value}/{total} Stocks`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  progressBar.start(dataRows.length, 0);

  dataRows.forEach((row, index) => {
    const cols = $(row).find('td');
    if (cols.length >= 5) {
      stocks.push({ Symbol: $(cols[1]).text().trim() });
    }
    progressBar.update(index + 1);
  });

  progressBar.stop();

  console.log(`✅ Parsed ${stocks.length} stocks for Category ${group}`);
  return stocks;
}

(async () => {
  const stocksA = await tradingCode('A');
  const stocksB = await tradingCode('B');
  const stocksBank = await tradingCode('BANK');

  await uploadAllCategoriesToGoogleSheets(stocksA, stocksB, stocksBank);

  console.log(`✅ All categories uploaded to Google Sheets successfully.`);
})();
