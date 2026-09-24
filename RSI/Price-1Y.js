const http = require('../lib/http');
const XLSX = require('xlsx');
const cliProgress = require('cli-progress');
const { uploadExcelToGoogleSheets } = require('./googleSheetsRSI1Y');
const companies = require('../data/companies.json');

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

function getAllTradingCodes() {
    return [...new Set(
        companies
            .filter((company) => company.category === 'A' || company.category === 'B' || company.sector === 'Bank')
            .map((company) => company.tradingCode)
    )];
}

function extractSeries(html) {
    const marker = '\\"series\\":';
    const start = html.indexOf(marker);
    if (start < 0) return [];

    let i = start + marker.length;
    if (html[i] !== '[') return [];

    let depth = 0;
    let out = '';
    let inString = false;
    for (; i < html.length; i++) {
        const ch = html[i];
        out += ch;
        if (ch === '\\') {
            out += html[++i] || '';
            continue;
        }
        if (ch === '"') inString = !inString;
        if (inString) continue;
        if (ch === '[') depth++;
        else if (ch === ']') {
            depth--;
            if (depth === 0) break;
        }
    }

    return JSON.parse(out.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
}

async function fetchRSIData(code) {
    try {
        const { data } = await http.get(`https://www.dsebd.org/company/${encodeURIComponent(code)}`);
        const series = extractSeries(data);
        return series
            .filter((point) => point.date && Number.isFinite(Number(point.price)))
            .map((point) => [point.date, Number(point.price)]);
    } catch (err) {
        console.error(`Failed to fetch RSI data for ${code}:`, err.message);
        return [];
    }
}

async function main() {
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
                const [year, month, day] = date.split('-');
                datePriceMap[`${day}/${month}/${year}`] = price;
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
    console.log('Uploaded to Google Sheets');
}

if (require.main === module) {
    main();
}

module.exports = { fetchRSIData, getAllTradingCodes };
