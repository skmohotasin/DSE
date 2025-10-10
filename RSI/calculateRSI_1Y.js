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
  const newWb = XLSX.utils.book_new();

  wb.SheetNames.forEach((sheetName, sheetIndex) => {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headers = data[0];
    const dates = data.slice(1).map(r => r[0]);
    const rsiSheet = [["Date", ...headers.slice(1)]];

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
        if (!rsiSheet[i + 1]) rsiSheet.push([dates[i]]);
        rsiSheet[i + 1][c + 1] = RSIvalues[i];
      }

      progressBar.update(c + 1);
    }

    progressBar.stop();

    const newSheetName = `RSI 1Y Page ${sheetIndex + 1}`;
    const newWs = XLSX.utils.aoa_to_sheet(rsiSheet);
    XLSX.utils.book_append_sheet(newWb, newWs, newSheetName);
  });

  XLSX.writeFile(newWb, outputFile);
  console.log(`✅ RSI calculation complete. Saved as: ${outputFile}`);
}

async function runRSI1Y() {
  const inputFile = "./Price_1Y_temp.xlsx";
  const outputFile = "./RSI_1Y_temp.xlsx";

  processRSIExcel(inputFile, outputFile);

  await uploadExcelToGoogleSheets(outputFile, "1MrhKxLExlFX9HkyuSBexi70MkkP7tO7784ltkaWnXUs");
  console.log("✅ RSI 1Y uploaded to Google Sheets");
}

runRSI1Y();

