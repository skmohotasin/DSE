const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');
const { uploadToGoogleSheets } = require('./googleSheetsTradingCode');

async function tradingCode(group) {
  try {
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
      return;
    }

    const dataRows = rows.slice(1).toArray();
    const progressBar = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% || {value}/{total} Stocks',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });

    progressBar.start(dataRows.length, 0);

    dataRows.forEach((row, index) => {
      const cols = $(row).find('td');
      if (cols.length >= 5) {
        stocks.push({
          Symbol: $(cols[1]).text().trim(),
        });
      }
      progressBar.update(index + 1);
    });

    progressBar.stop();

    if (stocks.length === 0) {
      console.warn(`⚠️ No valid stock data parsed for group ${group}`);
      return;
    }

    await uploadToGoogleSheets(stocks);

    console.log(`✅ Added ${stocks.length} daily records for ${group}`);
  } catch (error) {
    console.error(`❌ Daily scrape error for group ${group}:`, error.message);
  }
}

const groupArg = process.argv[2]?.toUpperCase() || 'A';

if (['A', 'B', 'BANK'].includes(groupArg)) {
  tradingCode(groupArg);
} else {
  console.log('Usage: node trading-code.js [A|B|BANK]');
}
