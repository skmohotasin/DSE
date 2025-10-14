const axios = require('axios');
const cheerio = require('cheerio');
const XLSX = require('xlsx');
const cliProgress = require('cli-progress');
const { uploadExcelToGoogleSheets } = require('./googleSheetsRSI1Y');

function generateLast365Days() {
    const dates = [];
    const today = new Date();
    for (let i = 359; i >= 0; i--) {
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

    let existingData = [];
    try {
        const wbOld = XLSX.readFile('./Price_1Y_temp.xlsx');
        const wsOld = wbOld.Sheets[wbOld.SheetNames[0]];
        existingData = XLSX.utils.sheet_to_json(wsOld, { header: 1 });
    } catch (e) {
        console.log('No previous file found, creating new...');
    }

    const allCodes = existingData[0] ? existingData[0].slice(1) : codes;
    const mergedCodes = [...new Set([...allCodes, ...codes])];
    const mergedData = [['Date', ...mergedCodes]];

    for (let i = 1; i <= dates.length; i++) {
        const oldRow = existingData[i] || [];
        const newRow = [dates[i-1]];

        for (let c = 1; c <= mergedCodes.length; c++) {
            const code = mergedCodes[c-1];
            const idxOld = oldRow ? oldRow.indexOf(code) : -1;

            if (oldRow[c] !== undefined) {
                newRow.push(oldRow[c]);
            } else if (i > dates.length - 360) {
                newRow.push(null);
            } else {
                newRow.push(oldRow[c] ?? null);
            }
        }

        mergedData.push(newRow);
    }

    for (let c = 0; c < codes.length; c++) {
        const code = codes[c];
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

            for (let i = dates.length - 360; i < dates.length; i++) {
                if (datePriceMap[dates[i]] !== undefined) {
                    const colIndex = mergedData[0].indexOf(code);
                    if (colIndex !== -1) mergedData[i+1][colIndex] = datePriceMap[dates[i]];
                }
            }
        }

        progressBar.update(c + 1);
    }

    progressBar.stop();

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(wb, ws, 'Price 1Y');
    XLSX.writeFile(wb, './Price_1Y_temp.xlsx');

    console.log('✅ Price 1Y updated and saved: Price_1Y_temp.xlsx');
    await uploadExcelToGoogleSheets('./Price_1Y_temp.xlsx', '1FxV4HYgoV7qYXjw6eEqF4Ax4tjHQqVJ9G-fwKLxaHxI');
    console.log('✅ Uploaded to Google Sheets');
})();
