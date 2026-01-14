const { GoogleSpreadsheet } = require('google-spreadsheet');
const ExcelJS = require('exceljs');
const fetch = require('node-fetch');
const path = require('path');

// === CONFIG ===
const SPREADSHEET_ID = '1db29opTkQO4s9mwX9LZb_qJHXDzHgp2F4dDzxM58puA';
const SERVICE_ACCOUNT_KEY_FILE = path.join(__dirname, '..', 'service-account.json');
const OLLAMA_MODEL = 'qwen2.5:7b';

// === 1. Download Google Sheet ===
async function downloadSheet() {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
    await doc.useServiceAccountAuth(require(SERVICE_ACCOUNT_KEY_FILE));
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // first sheet
    const rows = await sheet.getRows();
    
    // Convert to array of objects
    return rows.map(r => ({
        Date: r.Date,
        Symbol: r.Symbol,
        Open: r.Open,
        High: r.High,
        Low: r.Low,
        Close: r.Close,
        Volume: r.Volume
    }));
}

// === 2. Prepare prompt for Ollama ===
function buildPrompt(data) {
    const last10 = data.slice(-10)
        .map(r => `${r.Date} ${r.Symbol} Close:${r.Close} Volume:${r.Volume}`)
        .join('\n');
    
    return `
You are a professional DSE stock analyst.
Analyze the following recent stock data.
Give concise analysis of each stock, including trend, momentum, and any warning signals.

${last10}
`;
}

// === 3. Call Ollama ===
async function analyzeWithOllama(prompt) {
    const res = await fetch('http://localhost:11434/v1/chat/completions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages: [
                {role: 'system', content: 'You are a stock market analyst.'},
                {role: 'user', content: prompt}
            ]
        })
    });
    const data = await res.json();
    return data.choices[0].message.content;
}

// === 4. Save analysis to Excel ===
async function saveAnalysisToExcel(analysis) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Analysis');
    sheet.addRow(['Analysis']);
    sheet.addRow([analysis]);
    await workbook.xlsx.writeFile('analysis.xlsx');
    console.log('Saved analysis.xlsx ✅');
}

// === MAIN FUNCTION ===
(async () => {
    try {
        const sheetData = await downloadSheet();
        console.log(`Downloaded ${sheetData.length} rows from Google Sheet`);
        
        const prompt = buildPrompt(sheetData);
        const analysis = await analyzeWithOllama(prompt);
        
        console.log('Analysis from Ollama:\n', analysis);
        await saveAnalysisToExcel(analysis);
    } catch (err) {
        console.error(err);
    }
})();
