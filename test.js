const http = require('./lib/http');
const cheerio = require('cheerio');

function clean(text) {
    return text.replace(/\s+/g, ' ').trim();
}

async function scrapeGovtShare(symbol) {
    try {
        const { data } = await http.get(`https://www.dsebd.org/company/${encodeURIComponent(symbol)}`);
        const $ = cheerio.load(data);

        const heading = $('h3').filter((_, el) => /shareholding pattern/i.test($(el).text())).first();
        if (!heading.length) {
            console.warn(`No shareholding pattern found for ${symbol}`);
            return null;
        }

        const datesGrid = heading.parent().next();
        const rowsWrap = datesGrid.next();

        const dates = datesGrid.children('div').map((_, el) => clean($(el).text())).get().filter(Boolean);

        let govtValues = [];
        rowsWrap.children('div').each((_, row) => {
            const label = clean($(row).find('span.truncate').first().text());
            if (!/^government$/i.test(label)) return;

            govtValues = $(row).find('div.tnum').map((__, cell) => clean($(cell).text()).replace(/\s+/g, '')).get();
        });

        if (!govtValues.length) {
            console.warn(`No government shareholding row found for ${symbol}`);
            return null;
        }

        const asOn = dates[dates.length - 1] || '';
        const govtShare = govtValues[govtValues.length - 1];

        console.log(`Govt share holding (${asOn}):`, govtShare);
        return { asOn, govtShare, dates, govtValues };

    } catch (err) {
        console.warn(`Could not fetch govt share for ${symbol}: ${err.message}`);
        return null;
    }
}

async function test() {
    const symbol = process.argv[2];
    if (!symbol) {
        console.error('Usage: node test.js [SYMBOL]');
        process.exit(1);
    }

    console.log(`Fetching govt share holding for ${symbol} ...`);
    const data = await scrapeGovtShare(symbol);

    if (data) {
        console.log('Govt share:', data.govtShare);
    } else {
        console.log('Failed to fetch govt share holding.');
    }
}

test();
