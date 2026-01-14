// analysis/llama-dse.js
import { Llama } from 'llama-node';
import ExcelJS from 'exceljs';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import fs from 'fs';

const __dirname = path.resolve(); // for module path

// CONFIG
const CREDENTIALS_FILE = path.join(__dirname, '..', 'credentials.json');
const SPREADSHEET_ID = '1db29opTkQO4s9mwX9LZb_qJHXDzHgp2F4dDzxM58puA';
const MODEL_PATH = path.join(__dirname, 'models', 'llama-2-7b'); // path to your downloaded LLaMA 2 7B
const ROWS_TO_ANALYZE = 10;
const OUTPUT_FILE = path.join(__dirname, 'analysis.xlsx');

// 1. Fetch sheet data
async function getSheetRows() {
  if (!fs.existsSync(CREDENTIALS_FILE)) throw new Error(`Credentials file not found: ${CREDENTIALS_FILE}`);

  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetName = meta.data.sheets[0].properties.title;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });

  const rows = res.data.values || [];
  if (!rows.length) return [];

  const headers = rows.shift();
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
}

// 2. Build prompt
function buildPrompt(stockRows) {
  const lastRows = stockRows
    .slice(-ROWS_TO_ANALYZE)
    .map(r => `${r.Date} Close:${r.Close} Volume:${r.Volume}`)
    .join('\n');

  return `You are a professional DSE stock analyst.
Analyze the following recent stock data.
Give concise analysis including trend, momentum, and any warning signals:

${lastRows}`;
}

// 3. Analyze with LLaMA
async function analyzeWithLlama(prompt) {
  const llm = new Llama({
    model: MODEL_PATH,
    n_threads: 8,   // adjust threads if needed
    n_gpu_layers: 20, // approx for 12GB GPU
  });

  const response = await llm.prompt(prompt, {
    max_tokens: 500,
  });

  return response.text || 'No analysis returned';
}

// 4. Save to Excel
async function saveAnalysisToExcel(results) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Analysis');
  sheet.columns = [
    { header: 'Symbol', key: 'Symbol', width: 15 },
    { header: 'Analysis', key: 'Analysis', width: 100 },
  ];
  results.forEach(r => sheet.addRow({ Symbol: r.Symbol, Analysis: r.Analysis }));
  await workbook.xlsx.writeFile(OUTPUT_FILE);
  console.log(`Saved ${OUTPUT_FILE} ✅`);
}

// MAIN
(async () => {
  try {
    const sheetData = await getSheetRows();
    console.log(`Downloaded ${sheetData.length} rows from Google Sheet`);

    const symbols = [...new Set(sheetData.map(r => r.Symbol))];
    const results = [];

    for (const sym of symbols) {
      const stockRows = sheetData.filter(r => r.Symbol === sym);
      const prompt = buildPrompt(stockRows);
      const analysis = await analyzeWithLlama(prompt);
      console.log(`Analysis for ${sym}:\n${analysis}\n`);
      results.push({ Symbol: sym, Analysis: analysis });
    }

    await saveAnalysisToExcel(results);
  } catch (err) {
    console.error('Fatal error:', err.message);
  }
})();
