const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');
const fs = require('fs');

// Configure
const SPREADSHEET_ID = 'YOUR_SHEET_ID'; // Replace with your Google Sheet ID
const SHEET_NAME = 'Stocks'; // Tab name in your Sheet

async function uploadToGoogleSheets(data) {
  try {
    const auth = await authenticate({
      keyfilePath: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Clear existing data
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:Z`, // Keeps headers
    });

    // Prepare data (skip headers)
    const values = data.map(row => Object.values(row));

    // Update sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2`,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });

  } catch (error) {
    console.error('Google Sheets Error:', error.message);
    throw error;
  }
}

module.exports = { uploadToGoogleSheets };