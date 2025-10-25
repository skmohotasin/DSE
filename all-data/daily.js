const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');
const { saveAndUploadBoth } = require('./googleSheets');

async function scrapeDailyPrices(group) {
  try {
    const { data } = await axios.get(
      `https://dsebd.org/latest_share_price_scroll_group.php?group=${group}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      }
    );

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
          Date: new Date().toISOString().slice(0, 10),
          Symbol: $(cols[1]).text().trim(),
          YCP: $(cols[6]).text().trim(),
          LTP: $(cols[2]).text().trim(),
          CP: $(cols[5]).text().trim(),
          Low: $(cols[4]).text().trim(),
          High: $(cols[3]).text().trim(),
          Change: $(cols[7]).text().trim(),
          Volume: $(cols[10]).text().trim(),
        });
      }
      progressBar.update(index + 1);
    });

    progressBar.stop();

    if (stocks.length === 0) {
      console.warn(`⚠️ No valid stock data parsed for group ${group}`);
      return;
    }

    await saveAndUploadBoth(stocks, {
      group,
      isDaily: true
    });

    console.log(`✅ Added ${stocks.length} daily records to Category ${group}`);
  } catch (error) {
    console.error(`Daily scrape error for group ${group}:`, error.message);
  }
}

const groupArg = process.argv[2]?.toUpperCase() || 'A';
if (['A', 'B'].includes(groupArg)) {
  scrapeDailyPrices(groupArg);
} else {
  console.log('Usage: node scraper-daily.js [A|B]');
}
