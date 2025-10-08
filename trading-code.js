const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');

async function updateTradingCodes(symbols) {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const spreadsheetId = 'YOUR_SPREADSHEET_ID';

  const values = symbols.map(symbol => [symbol]);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'DSE RSI Data Table!C2',
    valueInputOption: 'RAW',
    resource: { values }
  });

  console.log(`✅ Updated ${symbols.length} Trading Codes in DSE RSI Data Table`);
}

async function scrapeTradingCodes() {
  try {
    const { data } = await axios.get(
      'https://www.dsebd.org/ltp_industry.php?area=11',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      }
    );

    const $ = cheerio.load(data);
    const rows = $('.table.table-bordered tr');
    const symbols = [];

    rows.slice(1).each(function (index, row) {
      const cols = $(row).find('td');
      const symbol = $(cols[1]).text().trim();
      if (symbol) symbols.push(symbol);
    });

    if (symbols.length === 0) {
      console.error('❌ No trading codes found.');
      return;
    }

    await updateTradingCodes(symbols);
  } catch (error) {
    console.error('❌ Error scraping trading codes:', error.message);
  }
}

scrapeTradingCodes();
