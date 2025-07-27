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

        const targetTable = $('table#company').eq(10);
        let govtShare = '';

        targetTable.find('tbody tr').each((_, tr) => {
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

        console.log('Govt Share Holding (as on Jun 30, 2025):', govtShare);
        return { Dividend: govtShare };

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
