const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');
const { saveAndUploadBoth } = require('./googleSheetsBanks');

async function scrapeDailyPrices() {
  try {
    const { data } = await axios.get(
      `https://www.dsebd.org/ltp_industry.php?area=11`,
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
      console.error(`❌ No data rows found for Bank`);
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
      console.warn(`⚠️ No valid stock data parsed for Bank`);
      return;
    }

    await saveAndUploadBoth(stocks, {isDaily: true});

    console.log(`✅ Added ${stocks.length} daily records to Bank`);
  } catch (error) {
    console.error(`Daily scrape error for Bank:`, error.message);
  }
}

const group = process.argv[2];

if (group === 'Bank') {
  scrapeDailyPrices();
} else {
  console.log('Usage: node scraper-daily-banks.js Bank');
}