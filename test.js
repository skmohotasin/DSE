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

        const targetTableTwo = $('table#company').eq(10);
        let category = '';

        targetTableTwo.find('td').each((_, td) => {
            const text = $(td).text().trim();
            if (text === 'Market Category') {
                category = $(td).next('td').text().trim();
            }
        });

        return { Dividend: category };

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
        console.log('NAV:', data.Dividend);
    } else {
        console.log('Failed to fetch NAV.');
    }
}

test();
