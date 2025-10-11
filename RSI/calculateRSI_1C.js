const { processRSIExcelByMonth } = require("./RSIUtils");
const { uploadExcelToGoogleSheets } = require("./googleSheetsRSI1Y");

const windowSize = parseInt(process.argv[2], 10) || 22;

async function runRSICustom(windowSize) {
  const inputFile = "./Price_1Y_temp.xlsx";
  const outputFile = `./RSI_${windowSize}D_temp.xlsx`;

  processRSIExcelByMonth(inputFile, outputFile, windowSize);
  await uploadExcelToGoogleSheets(outputFile, "1DxB91za_aQ2Sz1rtAerdn8RJVApHWOJjfKifYaLHPSQ");
  console.log(`✅ RSI ${windowSize}D calculation done`);
}

runRSICustom(windowSize);
