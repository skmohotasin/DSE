const XLSX = require("xlsx");
const cliProgress = require("cli-progress");
const { uploadExcelToGoogleSheets } = require("./googleSheetsRSI1Y");

function calculateCumulativeRSI(prices) {
  const gains = [];
  const losses = [];
  const results = [];

  for (let i = 0; i < prices.length; i++) {
    if (i === 0 || prices[i] === null || prices[i - 1] === null) {
      results.push(0);
      continue;
    }

    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains.push(diff);
    else if (diff < 0) losses.push(Math.abs(diff));

    const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

    let RS;
    if (avgLoss === 0 && avgGain === 0) RS = 1;
    else if (avgLoss === 0) RS = avgGain;
    else if (avgGain === 0) RS = 1 / (avgLoss * 10);
    else RS = avgGain / avgLoss;

    const RSI = 100 - 100 / (1 + RS);
    results.push(Number(RSI.toFixed(2)));
  }

  return results;
}

function processRSIExcel(inputFile, outputFile) {
  const wb = XLSX.readFile(inputFile);
  const mergedMap = new Map();
  const allHeadersSet = new Set();

  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headers = data[0];
    const dates = data.slice(1).map(r => r[0]);
    const priceColumns = headers.slice(1).map((_, i) =>
      data.slice(1).map(r => (r[i + 1] !== undefined && r[i + 1] !== "" ? parseFloat(r[i + 1]) : null))
    );

    const progressBar = new cliProgress.SingleBar(
      { format: `${sheetName} |{bar}| {percentage}% | {value}/{total} codes` },
      cliProgress.Presets.shades_classic
    );
    progressBar.start(priceColumns.length, 0);

    for (let c = 0; c < priceColumns.length; c++) {
      const prices = priceColumns[c];
      const RSIvalues = calculateCumulativeRSI(prices);

      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const headerName = headers[c + 1];
        if (!allHeadersSet.has(headerName)) allHeadersSet.add(headerName);

        if (!mergedMap.has(date)) mergedMap.set(date, { Date: date });
        mergedMap.get(date)[headerName] = RSIvalues[i];
      }

      progressBar.update(c + 1);
    }

    progressBar.stop();
  });

  const allHeaders = ["Date", ...Array.from(allHeadersSet).sort((a, b) => a.localeCompare(b))];

  const allSheetsData = [allHeaders];

  const sortedDates = Array.from(mergedMap.keys()).sort((a, b) => new Date(a) - new Date(b));
  sortedDates.forEach(date => {
    const rowObj = mergedMap.get(date);
    const row = allHeaders.map(h => (rowObj[h] !== undefined ? rowObj[h] : null));
    allSheetsData.push(row);
  });

  const newWb = XLSX.utils.book_new();
  const mergedWs = XLSX.utils.aoa_to_sheet(allSheetsData);
  XLSX.utils.book_append_sheet(newWb, mergedWs, "RSI 1Y");

  XLSX.writeFile(newWb, outputFile);
  console.log(`✅ RSI 1Y calculation complete. Saved as: ${outputFile}`);
}

async function runRSI1Y() {
  const inputFile = "./Price_1Y_temp.xlsx";
  const outputFile = "./RSI_1Y_temp.xlsx";

  processRSIExcel(inputFile, outputFile);

  await uploadExcelToGoogleSheets(outputFile, "1MrhKxLExlFX9HkyuSBexi70MkkP7tO7784ltkaWnXUs");
  console.log("✅ RSI 1Y uploaded to Google Sheets");
}

runRSI1Y();
