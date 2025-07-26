const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeNAV(symbol) {
    try {
        const { data } = await axios.get(`https://dsebd.org/displayCompany.php?name=${symbol}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        const $ = cheerio.load(data);

        let nav = '';
        const targetText = 'Financial Performance as per Audited Financial Statements as per IFRS/IAS or BFRS/BAS';
        const heading = $(`td:contains("${targetText}")`).filter((_, el) => $(el).text().trim() === targetText).first();

        const table = heading.closest('table').nextAll('table').first();
        const headers = [];

        table.find('tr').each((i, row) => {
            const cells = $(row).find('td, th');
            if (i === 0) {
                cells.each((_, cell) => {
                    headers.push($(cell).text().trim().toLowerCase());
                });
            } else {
                cells.each((j, cell) => {
                    const header = headers[j];
                    if (header && header.includes('nav per share')) {
                        const value = $(cell).text().trim();
                        if (!isNaN(parseFloat(value))) {
                            nav = value;
                        }
                    }
                });
            }
        });

        return { NAV: nav };


    } catch (err) {
        console.warn(`⚠️ Could not fetch NAV for ${symbol}: ${err.message}`);
        return null;
    }
}

async function test() {
    const symbol = process.argv[2];
    if (!symbol) {
        console.error('Usage: node scrapeNAV.js [SYMBOL]');
        process.exit(1);
    }

    console.log(`Fetching NAV for symbol: ${symbol} ...`);
    const data = await scrapeNAV(symbol);

    if (data) {
        console.log('NAV:', data.NAV);
    } else {
        console.log('Failed to fetch NAV.');
    }
}

test();
