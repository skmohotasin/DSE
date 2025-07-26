const axios = require('axios');
const cheerio = require('cheerio');
const { uploadToGoogleSheets } = require('./googleSheets');

async function scrapeCompanyDetails(symbol) {
  try {
    const { data } = await axios.get(`https://dsebd.org/displayCompany.php?name=${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const $ = cheerio.load(data);
    const pageText = $('body').text();

    const extract = (label, after = ':') => {
      const regex = new RegExp(`${label}\\s*${after}\\s*(.*?)\\s{2,}`, 'i');
      const match = pageText.match(regex);
      return match ? match[1].trim() : '';
    };

    // Extract NAV, EPS, Dividend too from the company page
    const nav = extract("NAV");
    const eps = extract("EPS");
    const dividend = extract("Dividend");

    return {
      Range52Wk: extract("52 Weeks' Moving Range"),
      LastAGM: extract("Last AGM held on"),
      EPSLastYr: extract("Using Basic EPS.*?Original.*?last year", ":"),
      DividendLastYr: extract("Dividend.*?last year", ":"),
      NAV: nav,
      EPS: eps,
      Dividend: dividend
    };
  } catch (err) {
    console.warn(`⚠️ Could not fetch company details for ${symbol}: ${err.message}`);
    return {
      Range52Wk: '',
      LastAGM: '',
      EPSLastYr: '',
      DividendLastYr: '',
      NAV: '',
      EPS: '',
      Dividend: ''
    };
  }
}

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

    const dataRows = rows.slice(1).toArray();

    for (const row of dataRows) {
      const cols = $(row).find('td');

      if (cols.length < 11) {
        console.warn('Skipping row due to insufficient columns');
        continue;
      }

      const symbol = $(cols[1]).text().trim();

      const extra = await scrapeCompanyDetails(symbol);

      stocks.push({
        Date: new Date().toISOString().slice(0, 10),
        Symbol: symbol,
        YCP: $(cols[6]).text().trim(),
        LTP: $(cols[2]).text().trim(),
        CP: $(cols[5]).text().trim(),
        Low: $(cols[4]).text().trim(),
        High: $(cols[3]).text().trim(),
        Change: $(cols[7]).text().trim(),
        Volume: $(cols[10]).text().trim(),
        NAV: extra.NAV,
        EPS: extra.EPS,
        Dividend: extra.Dividend,
        Range52Wk: extra.Range52Wk,
        LastAGM: extra.LastAGM,
        EPSLastYr: extra.EPSLastYr,
        DividendLastYr: extra.DividendLastYr
      });
    }

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
