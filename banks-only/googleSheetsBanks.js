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

function saveToExcel(data, filePath, isDaily = false) {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn(`⚠️ No data to save for ${filePath}`);
    return;
  }

  const fullHeaders = [
    'Date','Symbol','YCP','LTP','CP','Low','High','Change','Volume',
    'CompanyName','Category','Govtpercentage','Lowest','Highest','Range52Wk',
    'NAV','EPS','Dividend','LastAGM','Last1YGain'
  ];
  const dailyHeaders = fullHeaders.slice(0, 9);
  const headers = isDaily ? dailyHeaders : fullHeaders;

  const worksheetData = [
    headers,
    ...data.map(item => headers.map(h => item[h] !== undefined ? item[h] : ''))
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filePath);

  console.log(`✅ Saved Excel file: ${filePath} (${data.length} records)`);
}

async function uploadToGoogleSheets(data, { sheetName = 'Type Bank', isDaily = false } = {}) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('⚠️ No data to upload');
      return;
    }

    const auth = new GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const SPREADSHEET_ID = '1db29opTkQO4s9mwX9LZb_qJHXDzHgp2F4dDzxM58puA';

    await ensureSheetExists(sheets, SPREADSHEET_ID, sheetName);

    const fullHeaders = [
      'Date','Symbol','YCP','LTP','CP','Low','High','Change','Volume',
      'CompanyName','Category','Govtpercentage','Lowest','Highest','Range52Wk',
      'NAV','EPS','Dividend','LastAGM','Last1YGain'
    ];
    const dailyHeaders = fullHeaders.slice(0, 9);
    const headers = isDaily ? dailyHeaders : fullHeaders;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });

    const rows = data.map(item => headers.map(h => item[h] !== undefined ? item[h] : ''));

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:Z`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: rows }
    });

    console.log(`✅ Uploaded ${data.length} records to Google Sheets: ${sheetName}`);
  } catch (error) {
    console.error('Sheets API Error:', error.message);
    throw error;
  }
}

async function saveAndUploadBoth(data, { fileName, sheetName = 'Type Bank', isDaily = false } = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('⚠️ No data to save/upload');
    return;
  }

  const excelFile = fileName || `TypeBank_${isDaily ? 'Daily' : 'Full'}.xlsx`;
  saveToExcel(data, excelFile, isDaily);
  await uploadToGoogleSheets(data, { sheetName, isDaily });
}

module.exports = { saveToExcel, uploadToGoogleSheets, saveAndUploadBoth };
