const axios = require('axios');
const cheerio = require('cheerio');
const { uploadToGoogleSheets } = require('./googleSheets');

async function scrapeCategory(group) {
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
    const rows = $('.table.table-bordered tr');

    console.log(`Found ${rows.length} rows for group ${group}`);

    if (rows.length <= 1) {
      console.error(`❌ No data rows found for group ${group}`);
      return;
    }

    const stocks = [];

    rows.slice(1).each((i, row) => {
      const cols = $(row).find('td');

      // Debug columns count and first column text per row
      if (cols.length < 10) {
        console.warn(`Skipping row ${i + 1} due to insufficient columns (${cols.length})`);
        return;
      }

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
        NAV: $(cols[7]).text().trim(),
        EPS: $(cols[8]).text().trim(),
        Dividend: $(cols[9]).text().trim()
      });
    });

    console.log(`Parsed ${stocks.length} stock entries`);

    if (stocks.length === 0) {
      console.error('❌ No valid stock data parsed. The page structure may have changed.');
      return;
    }

    await uploadToGoogleSheets(stocks, {
      group,
      isDaily: false
    });

    console.log(`✅ Updated Category ${group} with ${stocks.length} records`);
  } catch (error) {
    console.error(`Category ${group} Error:`, error.message);
  }
}

const group = process.argv[2]?.toUpperCase() || 'A';
if (['A', 'B'].includes(group)) {
  scrapeCategory(group);
} else {
  console.log('Usage: node scraper-full.js [A|B]');
}
