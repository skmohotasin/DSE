const axios = require('axios');
const cheerio = require('cheerio');
const { uploadToGoogleSheets } = require('./googleSheets');

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

    rows.slice(1).each((i, row) => {
      const cols = $(row).find('td');
      if (cols.length >= 5) {
        stocks.push({
          Date: new Date().toISOString(),
          Symbol: $(cols[1]).text().trim(),
          LTP: $(cols[2]).text().trim(),
          High: $(cols[3]).text().trim(),
          Low: $(cols[4]).text().trim()
        });
      }
    });

    if (stocks.length === 0) {
      console.warn(`⚠️ No valid stock data parsed for group ${group}`);
      return;
    }

    await uploadToGoogleSheets(stocks, {
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
