const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const XLSX = require('xlsx');

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

function saveToExcel(data, sheetName, filePath, isDaily = false) {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn(`⚠️ No data to save for ${sheetName}`);
    return;
  }

  const fullHeaders = [
    'Date', 'Symbol', 'YCP', 'LTP', 'CP', 'Low', 'High', 'Change', 'Volume',
    'CompanyName', 'Sector', 'Lowest', 'Highest', 'Range52Wk', 'NAV', 'EPS', 'Dividend', 'LastAGM'
  ];
  const dailyHeaders = fullHeaders.slice(0, 9);
  const headers = isDaily ? dailyHeaders : fullHeaders;

  const worksheetData = [
    headers,
    ...data.map(item => headers.map(h => item[h] !== undefined ? item[h] : ''))
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);

  console.log(`✅ Saved Excel file: ${filePath} (${data.length} records)`);
}

async function uploadToGoogleSheets(data, { group = 'A', isDaily = false } = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn(`⚠️ No data to upload for Category ${group}`);
    return;
  }

  try {
    const auth = new GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const SPREADSHEET_ID = '1db29opTkQO4s9mwX9LZb_qJHXDzHgp2F4dDzxM58puA';
    const sheetName = isDaily ? `Category ${group} Daily` : `Category ${group} Full`;

    await ensureSheetExists(sheets, SPREADSHEET_ID, sheetName);

    const headers = isDaily
      ? ['Date', 'Symbol', 'YCP', 'LTP', 'CP', 'Low', 'High', 'Change', 'Volume']
      : [
          'Date', 'Symbol', 'YCP', 'LTP', 'CP', 'Low', 'High', 'Change', 'Volume',
          'CompanyName', 'Sector', 'Lowest', 'Highest', 'Range52Wk', 'NAV', 'EPS', 'Dividend', 'LastAGM', "Last1YGain"
        ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });

    const mergedRows = data.map(item => headers.map(h => item[h] !== undefined ? item[h] : ''));

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:Z`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: mergedRows }
    });

    console.log(`✅ Uploaded ${data.length} records to Google Sheets: ${sheetName}`);
  } catch (error) {
    console.error('Sheets API Error:', error.message);
    throw error;
  }
}

async function saveAndUploadBoth(data, { group = 'A', isDaily = false } = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn(`⚠️ No data for Category ${group}, skipping Excel and Google upload`);
    return;
  }

  const fileName = `Category_${group}_${isDaily ? 'Daily' : 'Full'}.xlsx`;

  saveToExcel(data, `Category ${group}`, fileName, isDaily);
  await uploadToGoogleSheets(data, { group, isDaily });
}

module.exports = { saveToExcel, uploadToGoogleSheets, saveAndUploadBoth };
