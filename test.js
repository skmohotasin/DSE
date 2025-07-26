const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeCompanyDetails(symbol) {
  try {
    const { data } = await axios.get(`https://dsebd.org/displayCompany.php?name=${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const $ = cheerio.load(data);

    const companyName = $('#section-to-print h2.BodyHead.topBodyHead i').first().text().trim();

    let lastAGM = '';
    $('div.col-sm-6.pull-left').each((_, el) => {
      if ($(el).text().includes('Last AGM held on:')) {
        lastAGM = $(el).find('i').text().trim();
      }
    });

    let rangeLow = '';
    let rangeHigh = '';
    const companyTable = $('#company');
    companyTable.find('th').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text === "52 Weeks' Moving Range") {
        const val = $(el).next('td').text().trim();
        const match = val.match(/([\d.,]+)\s*-\s*([\d.,]+)/);
        if (match) {
          rangeLow = match[1].replace(/,/g, '');
          rangeHigh = match[2].replace(/,/g, '');
        }
      }
    });

    let nav = '';
    companyTable.find('td').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text === 'nav' || text === 'nav per share') {
        nav = $(el).next('td').text().trim();
      }
    });

    // EPS and Dividend from Financial Performance... (Continued) table
    let EPS = '';
    let Dividend = '';

    // Find the financial performance table by matching headers or previous heading
    let finTable = null;
    $('table.table-bordered').each((_, table) => {
      const headers = $(table).find('thead tr th').map((i, th) => $(th).text().trim().toLowerCase()).get();

      if (headers.some(h => h.includes('eps')) && headers.some(h => h.includes('dividend'))) {
        finTable = $(table);
        return false; // break loop
      }
    });

    if (!finTable) {
      // fallback: find table with 'Financial Performance' in previous heading
      $('table.table-bordered').each((_, table) => {
        const prevHeading = $(table).prevAll('h4, strong').first().text().trim().toLowerCase();
        if (prevHeading.includes('financial performance')) {
          finTable = $(table);
          return false; // break loop
        }
      });
    }

    if (finTable) {
      const headers = finTable.find('thead tr th').map((i, th) => $(th).text().trim()).get();
      let epsIndex = -1;
      let dividendIndex = -1;

      headers.forEach((header, idx) => {
        const h = header.toLowerCase();
        if (h.includes('eps')) epsIndex = idx;
        if (h.includes('dividend')) dividendIndex = idx;
      });

      const lastRow = finTable.find('tbody tr').last();
      const cells = lastRow.find('td');

      if (epsIndex >= 0 && cells.eq(epsIndex).length) {
        EPS = cells.eq(epsIndex).text().trim();
      }
      if (dividendIndex >= 0 && cells.eq(dividendIndex).length) {
        Dividend = cells.eq(dividendIndex).text().trim();
      }
    }

    // Build the result object conditionally including EPS, Dividend, NAV
    const result = {
      CompanyName: companyName,
      Range52Wk: { low: rangeLow, high: rangeHigh },
      LastAGM: lastAGM,
    };

    if (EPS && EPS !== '') {
      result.EPS = EPS;
    }
    if (Dividend && Dividend !== '') {
      result.Dividend = Dividend;
    }
    if (nav && nav !== '' && nav.toLowerCase() !== 'profit/(loss) and oci') {
      result.NAV = nav;
    }

    return result;

  } catch (err) {
    console.warn(`⚠️ Could not fetch company details for ${symbol}: ${err.message}`);
    return null;
  }
}

async function test() {
  const symbol = process.argv[2];
  if (!symbol) {
    console.error('Usage: node scrapeCompanyDetails.js [SYMBOL]');
    process.exit(1);
  }

  console.log(`Fetching data for symbol: ${symbol} ...`);
  const data = await scrapeCompanyDetails(symbol);

  if (data) {
    console.log('Company data:', data);
  } else {
    console.log('Failed to fetch data.');
  }
}

test();
