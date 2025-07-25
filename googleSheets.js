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

function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

async function uploadToGoogleSheets(data, { group = 'A', isDaily = false } = {}) {
  try {
    const auth = new GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const SPREADSHEET_ID = '1db29opTkQO4s9mwX9LZb_qJHXDzHgp2F4dDzxM58puA';
    const sheetName = `Category ${group}`;
    const fullHeaders = ['LastUpdated', 'Symbol', 'LTP', 'High', 'Low', 'Close', 'YCP', 'NAV', 'EPS', 'Dividend'];

    await ensureSheetExists(sheets, SPREADSHEET_ID, sheetName);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      resource: { values: [fullHeaders] }
    });

    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:J`,
    });
    const existingRows = existingRes.data.values || [];

    const mergedRows = data.map((item, i) => {
      const existingRow = existingRows[i] || [];

      const first5 = isDaily
        ? [
            item.Date,
            item.Symbol,
            item.LTP,
            item.High,
            item.Low
          ]
        : [
            item.LastUpdated,
            item.Symbol,
            item.LTP,
            item.High,
            item.Low
          ];

      function mergeCell(newVal, oldVal) {
        return isEmpty(newVal) ? oldVal || '' : newVal;
      }

      if (isDaily) {
        const last5 = existingRow.slice(5, 10);
        const mergedFirst5 = first5.map((val, idx) => mergeCell(val, existingRow[idx]));
        const mergedLast5 = last5.map(val => val || '');
        return [...mergedFirst5, ...mergedLast5];
      } else {
        const fullData = [
          item.LastUpdated,
          item.Symbol,
          item.LTP,
          item.High,
          item.Low,
          item.Close,
          item.YCP,
          item.NAV,
          item.EPS,
          item.Dividend
        ];
        return fullData.map((val, idx) => mergeCell(val, existingRow[idx]));
      }
    });

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:J`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: mergedRows }
    });

    console.log(`✅ Updated ${sheetName} with ${data.length} records`);
  } catch (error) {
    console.error('Sheets API Error:', error.message);
    throw error;
  }
}

module.exports = { uploadToGoogleSheets };
