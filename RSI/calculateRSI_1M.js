const XLSX = require("xlsx");
const cliProgress = require("cli-progress");
const { uploadExcelToGoogleSheets } = require("./googleSheetsRSI1Y");
const windowSize = parseInt(process.argv[2], 10) || 30;

function calculateCumulativeRSIByMonth(prices, window = windowSize) {
  const results = [];

  for (let i = 0; i < prices.length; i++) {
    if (i === 0 || prices[i] === null || prices[i - 1] === null) {
      results.push(0);
      continue;
    }

    const startIdx = Math.max(0, i - window + 1);
    const slice = prices.slice(startIdx, i + 1);

    const gains = [];
    const losses = [];

    for (let j = 1; j < slice.length; j++) {
      const diff = slice[j] - slice[j - 1];
      if (diff > 0) gains.push(diff);
      else if (diff < 0) losses.push(Math.abs(diff));
    }

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

function processRSIExcelByMonth(inputFile, outputFile, window) {
  const wb = XLSX.readFile(inputFile);
  const newWb = XLSX.utils.book_new();

  const mergedMap = new Map();
  const allHeadersSet = new Set();

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headers = data[0];
    const dates = data.slice(1).map(r => r[0]);

    const priceColumns = headers.slice(1).map((_, i) =>
      data.slice(1).map(r => (r[i + 1] !== undefined && r[i + 1] !== "" ? parseFloat(r[i + 1]) : null))
    );

    const progressBar = new cliProgress.SingleBar(
      { format: `${sheetName} | RSI ${window}D |{bar}| {percentage}% | {value}/{total} codes` },
      cliProgress.Presets.shades_classic
    );
    progressBar.start(priceColumns.length, 0);

    for (let c = 0; c < priceColumns.length; c++) {
      const prices = priceColumns[c];
      const RSIvalues = calculateCumulativeRSIByMonth(prices, window);

      const startIndex = Math.max(0, dates.length - window);
      for (let i = startIndex; i < dates.length; i++) {
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

  const allHeaders = ["Date", ...Array.from(allHeadersSet)];
  const allSheetsData = [allHeaders];

  const sortedDates = Array.from(mergedMap.keys()).sort((a, b) => new Date(a) - new Date(b));
  sortedDates.forEach(date => {
    const rowObj = mergedMap.get(date);
    const row = allHeaders.map(h => (rowObj[h] !== undefined ? rowObj[h] : null));
    allSheetsData.push(row);
  });

  const mergedWs = XLSX.utils.aoa_to_sheet(allSheetsData);
  XLSX.utils.book_append_sheet(newWb, mergedWs, window != 30 ? `RSI ${window}D` : `RSI 1M`);

  XLSX.writeFile(newWb, outputFile);
  console.log(`✅ ${window}D RSI calculation complete. Saved as: ${outputFile}`);
}

async function runRSI1M(windowSize) {
  const inputFile = "./Price_1Y_temp.xlsx";
  const outputFile = windowSize != 30 ? `./RSI_${windowSize}D_temp.xlsx` : "./RSI_1M_temp.xlsx";

  processRSIExcelByMonth(inputFile, outputFile, windowSize);

  if (windowSize === 30) {
    await uploadExcelToGoogleSheets(outputFile, "1J81OSaZFJJx-F_fJEVnA4x0FxSOKoIDXskaibdAokBw");
    console.log("✅ RSI 1M calculation done");
  } else {
    await uploadExcelToGoogleSheets(outputFile, "1DxB91za_aQ2Sz1rtAerdn8RJVApHWOJjfKifYaLHPSQ");
    console.log(`✅ RSI ${windowSize}D calculation done`);
  }
}

runRSI1M(windowSize);
