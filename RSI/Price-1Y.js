const axios = require('axios');
const cheerio = require('cheerio');
const XLSX = require('xlsx');
const cliProgress = require('cli-progress');
const { uploadExcelToGoogleSheets } = require('./googleSheetsRSI1Y');

function generateLast365Days() {
    const dates = [];
    const today = new Date();
    for (let i = 361; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        dates.push(`${day}/${month}/${year}`);
    }
    return dates;
}

async function fetchTradingCodesFromURL(url, columnIndex = 1) {
    const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    const $ = cheerio.load(data);
    const codes = [];
    $('.table.table-bordered tr').slice(1).each((_, row) => {
        const cols = $(row).find('td');
        if (cols.length > columnIndex) {
            const code = $(cols[columnIndex]).text().trim();
            if (code) codes.push(code);
        }
    });
    return codes;
}

async function getAllTradingCodes() {
    const categoryAURL = 'https://dsebd.org/latest_share_price_scroll_group.php?group=A';
    const categoryBURL = 'https://dsebd.org/latest_share_price_scroll_group.php?group=B';
    const bankURL = 'https://www.dsebd.org/ltp_industry.php?area=11';

    const [codesA, codesB, codesBank] = await Promise.all([
        fetchTradingCodesFromURL(categoryAURL),
        fetchTradingCodesFromURL(categoryBURL),
        fetchTradingCodesFromURL(bankURL)
    ]);

    return [...new Set([...codesA, ...codesB, ...codesBank])];
}

async function fetchRSIData(code) {
    try {
        const url = `https://www.dsebd.org/php_graph/monthly_graph.php?inst=${code}&duration=12&type=price`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });

        const regex = /"Date,Price\\n(.+?)"\s*,/s;
        const match = data.match(regex);
        if (!match) return [];

        return match[1].split('\\n').filter(l => l.trim()).map(line => {
            const [date, price] = line.split(',');
            return [date.trim(), parseFloat(price)];
        });
    } catch (err) {
        console.error(`❌ Failed to fetch RSI data for ${code}:`, err.message);
        return [];
    }
}

(async () => {
    const codes = await getAllTradingCodes();
    console.log(`Found ${codes.length} trading codes`);

    const dates = generateLast365Days();

    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(codes.length, 0);

    const wb = XLSX.utils.book_new();

    const batchSize = 26;
    for (let page = 0; page * batchSize < codes.length; page++) {
        const batchCodes = codes.slice(page * batchSize, (page + 1) * batchSize);
        const tempData = [['Date', ...batchCodes]];
        for (let d of dates) tempData.push([d, ...Array(batchCodes.length).fill(null)]);

        for (let c = 0; c < batchCodes.length; c++) {
            const code = batchCodes[c];
            const rsiData = await fetchRSIData(code);

            if (rsiData.length) {
                const datePriceMap = {};
                rsiData.forEach(([date, price]) => {
                    const d = new Date(date);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    const formatted = `${day}/${month}/${year}`;
                    datePriceMap[formatted] = price;
                });

                let lastValue = null;
                for (let i = 0; i < dates.length; i++) {
                    if (datePriceMap[dates[i]] !== undefined) lastValue = datePriceMap[dates[i]];
                    tempData[i + 1][c + 1] = lastValue !== null ? lastValue : '';
                }
            }

            progressBar.update(page * batchSize + c + 1);
        }

        const sheetName = `Price 1Y Page ${page + 1}`;
        const ws = XLSX.utils.aoa_to_sheet(tempData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    progressBar.stop();
    XLSX.writeFile(wb, './Price_1Y_temp.xlsx');
    console.log('✅ Temporary Excel file saved: Price_1Y_temp.xlsx with multiple pages');
    await uploadExcelToGoogleSheets('./Price_1Y_temp.xlsx', '1FxV4HYgoV7qYXjw6eEqF4Ax4tjHQqVJ9G-fwKLxaHxI');
})();
