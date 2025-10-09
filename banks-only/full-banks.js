const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');
const { uploadToGoogleSheets } = require('./googleSheetsBanks');

async function scrapeCompanyDetails(symbol) {
  try {
    const { data } = await axios.get(`https://dsebd.org/displayCompany.php?name=${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const $ = cheerio.load(data);

    const companyName = $('#section-to-print h2.BodyHead.topBodyHead i').first().text().trim();
    const targetTableTwo = $('table#company').eq(10);
    let category = '';

    targetTableTwo.find('td').each((_, td) => {
      const text = $(td).text().trim();
      if (text === 'Market Category') {
        category = $(td).next('td').text().trim();
      }
    });

    const targetTableTen = $('table#company').eq(10);
    let govtShare = '';

    targetTableTen.find('tbody tr').each((_, tr) => {
      const firstTd = $(tr).find('td').first().text().trim();
      if (firstTd.includes('Share Holding Percentage') && firstTd.includes('Jun 30, 2025')) {
        const nestedTds = $(tr).find('td').eq(1).find('table tbody tr td');
        nestedTds.each((_, td) => {
          const text = $(td).text().trim();
          if (text.startsWith('Govt:')) {
            govtShare = text.split('Govt:')[1].trim();
          }
        });
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
          range = Number(rangeHigh) - Number(rangeLow);
        }
      }
    });

    let DividendValue = '';
    let EPSValue = '';

    $('#company tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      const yearText = cells.eq(0).text().trim();
      const is2024 = yearText === '2024' || cells.eq(1).text().trim() === '2024';
      if (is2024) {
        DividendValue = cells.eq(7).text().trim();
        EPSValue = cells.eq(4).text().trim();
      }
    });

    let NAVValue = '';

    const targetTable = $('table#company').eq(7);
    const rows = targetTable.find('tbody tr');

    rows.each((_, row) => {
      const cells = $(row).find('td');
      const yearText = cells.eq(0).text().trim();
      const is2024 = yearText === '2024' || cells.eq(1).text().trim() === '2024';
      if (is2024) {
        NAVValue = cells.eq(7).text().trim();
      }
    });


    let lastAGM = '';
    $('div.col-sm-6.pull-left').each((_, el) => {
      if ($(el).text().includes('Last AGM held on:')) {
        lastAGM = $(el).find('i').text().replace(/\s+/g, ' ').trim();
      }
    });


    return {
      CompanyName: companyName,
      Category: category,
      GovtShare: govtShare,
      Range52Wk: { lowest: rangeLow, highest: rangeHigh, range: range },
      NAV: NAVValue,
      EPS: EPSValue,
      Dividend: DividendValue,
      LastAGM: lastAGM,
    };

  } catch (err) {
    console.warn(`⚠️ Could not fetch company details for ${symbol}: ${err.message}`);
    return null;
  }
}

async function scrapeCategory() {
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
    const rows = $('.table.table-bordered tr');

    console.log(`Found ${rows.length} rows for Bank`);

    if (rows.length <= 1) {
      console.error(`❌ No data rows found for Bank`);
      return;
    }

    const stocks = [];

    const dataRows = rows.slice(1).toArray();

    const progressBar = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% || {value}/{total} Companies',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    progressBar.start(dataRows.length, 0);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const cols = $(row).find('td');

      if (cols.length < 11) {
        console.warn('Skipping row due to insufficient columns');
        progressBar.increment();
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
        CompanyName: extra.CompanyName,
        Category: extra.Category,
        Govtpercentage: extra.GovtShare,
        Lowest: extra.Range52Wk.lowest,
        Highest: extra.Range52Wk.highest,
        Range52Wk: extra.Range52Wk.range,
        NAV: extra.NAV,
        EPS: extra.EPS,
        Dividend: extra.Dividend,
        LastAGM: extra.LastAGM
      });

      progressBar.update(i + 1);
    }

    progressBar.stop();

    console.log(`Parsed ${stocks.length} stock entries`);

    if (stocks.length === 0) {
      console.error('❌ No valid stock data parsed. The page structure may have changed.');
      return;
    }

    await uploadToGoogleSheets(stocks, { isDaily: false });

    console.log(`✅ Updated Category Bank with ${stocks.length} records`);
  } catch (error) {
    console.error(`Category Bank Error:`, error.message);
  }
}

const group = process.argv[2];

if (group === 'Bank') {
  scrapeCategory();
} else {
  console.log('Usage: node scraper-full-banks.js Bank');
}