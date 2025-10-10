const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const XLSX = require('xlsx');

function getColumnLetter(colIndex) {
  let letter = '';
  while (colIndex >= 0) {
    letter = String.fromCharCode((colIndex % 26) + 65) + letter;
    colIndex = Math.floor(colIndex / 26) - 1;
  }
  return letter;
}

async function ensureSheetExists(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheet = res.data.sheets.find(s => s.properties.title === tabName);

  if (!existingSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests: [{ addSheet: { properties: { title: tabName } } }] }
    });
  }
}

async function uploadExcelToGoogleSheets(filePath, spreadsheetId) {
  const workbook = XLSX.readFile(filePath);
  const auth = new GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  for (const sheetName of workbook.SheetNames) {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    if (!data.length) continue;

    await ensureSheetExists(sheets, spreadsheetId, sheetName);
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${sheetName}'`
    });

    const lastColLetter = getColumnLetter(data[0].length - 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A1:${lastColLetter}${data.length}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: data }
    });

    console.log(`✅ Uploaded: ${sheetName}`);
  }

  console.log('🎉 All sheets uploaded successfully!');
}

module.exports = { uploadExcelToGoogleSheets };