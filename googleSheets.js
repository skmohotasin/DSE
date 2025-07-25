const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

async function ensureSheetExists(sheets, spreadsheetId, sheetName) {
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    if (!res.data.sheets.some(s => s.properties.title === sheetName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
      });
    }
  } catch (error) {
    console.error('Sheet creation failed:', error.message);
    throw error;
  }
}

async function uploadToGoogleSheets(data, { group = 'A', isDaily = false } = {}) {
  try {
    const auth = new GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const SPREADSHEET_ID = '1db29opTkQO4s9mwX9LZb_qJHXDzHgp2F4dDzxM58puA';

    // Always use the same tab name to overwrite previous data
    const sheetName = `Category ${group}`;

    // Different headers depending on daily or full data
    const headers = isDaily
      ? ['Date', 'Symbol', 'LTP', 'High', 'Low']
      : ['LastUpdated', 'Symbol', 'LTP', 'High', 'Low', 'Close', 'YCP', 'NAV', 'EPS', 'Dividend'];

    await ensureSheetExists(sheets, SPREADSHEET_ID, sheetName);

    // Write headers to row 1
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });

    // Clear existing data from row 2 onwards
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:Z`,
    });

    // Prepare data rows
    const values = isDaily
      ? data.map(item => [
          item.Date,
          item.Symbol,
          item.LTP,
          item.High,
          item.Low
        ])
      : data.map(item => [
          item.LastUpdated,
          item.Symbol,
          item.LTP,
          item.High,
          item.Low,
          item.Close || '',
          item.YCP || '',
          item.NAV || '',
          item.EPS || '',
          item.Dividend || ''
        ]);

    // Write data starting at row 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    console.log(`✅ Updated ${sheetName} with ${data.length} records`);
  } catch (error) {
    console.error('Sheets API Error:', error.message);
    throw error;
  }
}

module.exports = { uploadToGoogleSheets };
