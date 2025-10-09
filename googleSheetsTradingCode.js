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

async function uploadToGoogleSheets(data) {
  try {
    const auth = new GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const SPREADSHEET_ID = '1FxV4HYgoV7qYXjw6eEqF4Ax4tjHQqVJ9G-fwKLxaHxI';
    const tabName = `Trading Code`;
    const headers = ['Date', 'Category A', 'Category B', 'Type Bank'];

    await ensureSheetExists(sheets, SPREADSHEET_ID, tabName);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });

    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A2:D`,
    });

    const existingRows = existingRes.data.values || [];
    const today = formatDate(new Date());

    const categoryField =
      data[0].SymbolCategoryA !== undefined
        ? 'A'
        : data[0].SymbolCategoryB !== undefined
        ? 'B'
        : 'Bank';

    const value =
      categoryField === 'A'
        ? data[0].SymbolCategoryA
        : categoryField === 'B'
        ? data[0].SymbolCategoryB
        : data[0].SymbolTypeBank;

    let updated = false;

    const newRows = existingRows.map(row => {
      const [date, catA, catB, bank] = row;
      if (date === today) {
        updated = true;
        return [
          date || today,
          categoryField === 'A' ? value : catA || '',
          categoryField === 'B' ? value : catB || '',
          categoryField === 'Bank' ? value : bank || ''
        ];
      }
      return row;
    });

    if (!updated) {
      newRows.push([
        today,
        categoryField === 'A' ? value : '',
        categoryField === 'B' ? value : '',
        categoryField === 'Bank' ? value : ''
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
      resource: { values: newRows }
    });

    console.log(`✅ Updated ${tabName} for ${today} (${categoryField})`);
  } catch (error) {
    console.error('Sheets API Error:', error.message);
    throw error;
  }
}

module.exports = { uploadToGoogleSheets };
