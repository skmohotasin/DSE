const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

function formatDate(d) {
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

async function ensureSheetExists(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  if (!res.data.sheets.some(s => s.properties.title === tabName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests: [{ addSheet: { properties: { title: tabName } } }] }
    });
  }
}

async function uploadAllCategoriesToGoogleSheets(categoryA = [], categoryB = [], bank = []) {
  try {
    const auth = new GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const SPREADSHEET_ID = '1FxV4HYgoV7qYXjw6eEqF4Ax4tjHQqVJ9G-fwKLxaHxI';
    const tabName = 'Trading Code';
    const headers = ['Date', 'Category A', 'Category B', 'Type Bank'];

    await ensureSheetExists(sheets, SPREADSHEET_ID, tabName);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });

    const today = formatDate(new Date());

    const maxRows = Math.max(categoryA.length, categoryB.length, bank.length);

    const values = [];
    for (let i = 0; i < maxRows; i++) {
      values.push([
        today,
        categoryA[i]?.Symbol || '',
        categoryB[i]?.Symbol || '',
        bank[i]?.Symbol || ''
      ]);
    }

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A2:D`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A2`,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    console.log(`✅ Updated ${tabName} for ${today} with all categories`);
  } catch (error) {
    console.error('Sheets API Error:', error.message);
  }
}

module.exports = { uploadAllCategoriesToGoogleSheets };
