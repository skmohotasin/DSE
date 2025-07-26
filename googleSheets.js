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
    const fullHeaders = ['Date', 'Trading Code ', 'YCP (Yesterdays closing price)', 'LTP (Last trading price)', 'CP (Closing Price)', 'Low', 'High', 'Change', 'Volume', 'NAV', 'EPS', 'Dividend'];

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

      const first9 = isDaily
        ? [
          item.Date,
          item.Symbol,
          item.YCP,
          item.LTP,
          item.CP,
          item.Low,
          item.High,
          item.Change,
          item.Volume
        ]
        : [
          item.Date,
          item.Symbol,
          item.YCP,
          item.LTP,
          item.CP,
          item.Low,
          item.High,
          item.Change,
          item.Volume,
          item.NAV,
          item.EPS,
          item.Dividend
        ];

      function mergeCell(newVal, oldVal) {
        return isEmpty(newVal) ? oldVal || '' : newVal;
      }

      if (isDaily) {
        const last3 = existingRow.slice(10, 12);
        const mergedFirst9 = first9.map((val, idx) => mergeCell(val, existingRow[idx]));
        const mergedlast3 = last3.map(val => val || '');
        return [...mergedFirst9, ...mergedlast3];
      } else {
        const fullData = [
          item.Date,
          item.Symbol,
          item.YCP,
          item.LTP,
          item.CP,
          item.Low,
          item.High,
          item.Change,
          item.Volume,
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
