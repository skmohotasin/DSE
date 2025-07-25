const axios = require('axios');
const cheerio = require('cheerio');
const { stringify } = require('csv-stringify/sync');
const fs = require('fs');
const { uploadToGoogleSheets } = require('./googleSheets');

const DSE_URL = 'https://dsebd.org/latest_share_price_scroll_group.php?group=A';

async function scrapeDSE() {
  try {
    console.log('📡 Fetching DSE data...');
    const { data } = await axios.get(DSE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const stocks = [];

    $('.table.table-bordered tr').each((i, row) => {
      if (i === 0) return; // Skip header
      const cols = $(row).find('td');
      stocks.push({
        Symbol: $(cols[1]).text().trim(),
        LTP: $(cols[2]).text().trim(),
        High: $(cols[3]).text().trim(),
        Low: $(cols[4]).text().trim(),
        Close: $(cols[5]).text().trim(),
        YCP: $(cols[6]).text().trim(),
        NAV: $(cols[7]).text().trim(),
        EPS: $(cols[8]).text().trim(),
        Dividend: $(cols[9]).text().trim(),
        LastUpdated: new Date().toISOString()
      });
    });

    // Save local backup
    fs.writeFileSync('dse-backup.csv', stringify(stocks, { header: true }));
    
    // Push to Google Sheets
    await uploadToGoogleSheets(stocks);
    console.log('✅ Data pushed to Google Sheets!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

scrapeDSE();