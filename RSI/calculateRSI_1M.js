const { processRSIExcelByMonth } = require("./RSIUtils");
const { uploadExcelToGoogleSheets } = require("./googleSheetsRSI1Y");

async function runRSIMonth() {
  const windowSize = 30;
  const inputFile = "./Price_1Y_temp.xlsx";
  const outputFile = "./RSI_1M_temp.xlsx";

  processRSIExcelByMonth(inputFile, outputFile, windowSize);
  await uploadExcelToGoogleSheets(outputFile, "1J81OSaZFJJx-F_fJEVnA4x0FxSOKoIDXskaibdAokBw");
  console.log("✅ RSI 1M calculation done");
}

runRSIMonth();
