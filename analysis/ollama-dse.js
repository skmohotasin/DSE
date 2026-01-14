const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const fetch = global.fetch || require('node-fetch');
const cliProgress = require('cli-progress');

const CREDENTIALS_FILE = path.resolve(__dirname, '..', 'credentials.json');
const SPREADSHEET_ID = '1db29opTkQO4s9mwX9LZb_qJHXDzHgp2F4dDzxM58puA';
const OLLAMA_MODEL = 'qwen2.5:7b';
const ROWS_TO_ANALYZE = 10;
const OUTPUT_FILE = path.join(__dirname, 'analysis.xlsx');

// === 1. Read Google Sheet ===
async function getSheetRows() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error(`Credentials file not found at ${CREDENTIALS_FILE}`);
  }

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
    headers.forEach((h, i) => (obj[h] = row[i] || ''));
    return obj;
  });
}

// === 2. Build prompt per stock ===
function buildPrompt(stockRows) {
  const lastRows = stockRows
    .slice(-ROWS_TO_ANALYZE)
    .map(r => `${r.Date} Close:${r.Close} Volume:${r.Volume}`)
    .join('\n');

  return `You are a professional DSE stock analyst.
Analyze the following recent stock data.
Give concise analysis including trend, momentum, and any warning signals.

${lastRows}`;
}

// === 3. Call Ollama ===
async function analyzeWithOllama(prompt) {
  try {
    const res = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: 'You are a stock market analyst.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data = await res.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message)
      return 'No analysis returned';
    return data.choices[0].message.content;
  } catch (err) {
    console.error('Ollama API error:', err.message);
    return 'Error fetching analysis';
  }
}

// === 4. Save Excel ===
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

// === MAIN ===
(async () => {
  try {
    const sheetData = await getSheetRows();
    console.log(`Downloaded ${sheetData.length} rows from Google Sheet`);

    const symbols = [...new Set(sheetData.map(r => r.Symbol))];
    const results = [];

    // Initialize progress bar
    const progressBar = new cliProgress.SingleBar({
      format: 'Analyzing [{bar}] {percentage}% | {value}/{total} stocks',
      barCompleteChar: '#',
      barIncompleteChar: '-',
      hideCursor: true,
    });
    progressBar.start(symbols.length, 0);

    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      const stockRows = sheetData.filter(r => r.Symbol === sym);
      const prompt = buildPrompt(stockRows);
      const analysis = await analyzeWithOllama(prompt);
      results.push({ Symbol: sym, Analysis: analysis });
      progressBar.update(i + 1);
    }

    progressBar.stop();
    await saveAnalysisToExcel(results);
  } catch (err) {
    console.error('Fatal error:', err.message);
  }
})();
