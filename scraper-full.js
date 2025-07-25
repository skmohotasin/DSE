const axios = require('axios');
const cheerio = require('cheerio');
const { uploadToGoogleSheets } = require('./googleSheets');

async function scrapeCategory(group) {
  try {
    const { data } = await axios.get(
      `https://dsebd.org/latest_share_price_scroll_group.php?group=${group}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }
    );

    const $ = cheerio.load(data);
    const stocks = [];

    $('.table.table-bordered tr:not(:first-child)').each((i, row) => {
      const cols = $(row).find('td');
      if (cols.length >= 10) {
        stocks.push({
          LastUpdated: new Date().toISOString(),
          Symbol: $(cols[1]).text().trim(),
          LTP: $(cols[2]).text().trim(),
          High: $(cols[3]).text().trim(),
          Low: $(cols[4]).text().trim(),
          Close: $(cols[5]).text().trim(),
          YCP: $(cols[6]).text().trim(),
          NAV: $(cols[7]).text().trim(),
          EPS: $(cols[8]).text().trim(),
          Dividend: $(cols[9]).text().trim()
        });
      }
    });

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
