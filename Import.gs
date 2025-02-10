// IMPORT SHEET CONSTANTS
const IMPORT_SHEET_ID = 82376152;
const IMPORT_SHEET = SpreadsheetApp.getActiveSpreadsheet().getSheetById(IMPORT_SHEET_ID);

// MAPPING FROM MASTER ATTENDANCE SHEET TO SEMESTER SHEET
const IMPORT_MAP = {
  'timestamp' : TIMESTAMP_COL,
  'headrunners' : HEADRUNNERS_COL,
  'headRun' : HEADRUN_COL,
  'runLevel' : RUN_LEVEL_COL,
  'confirmation' : CONFIRMATION_COL,
  'distance' : DISTANCE_COL,
  'comments' : COMMENTS_COL,
  'platform' : PLATFORM_COL,
  'attendees' : ATTENDEES_BEGINNER_COL,
}

// USED TO IMPORT NEW ATTENDANCE SUBMISSION FROM APP
// TRIGGERED BY ZAPIER AUTOMATION OR BY MASTER ATTENDANCE SHEET
function onChange(e) {
  try {
    //console.log(e);   // Log event details
    const thisSource = e.source;
    const thisChange = e.changeType;

    // Verify if thisSource valid
    if (!thisSource) {
      console.log(`thisSource is not defined. Value: ${thisSource}`);
      return;
    }
    
    const thisSheetID = thisSource.getSheetId();

    // Exit early if the event is not related to the import sheet
    if (thisChange !== ['INSERT_ROW'] || thisSheetID != IMPORT_SHEET_ID) {
      console.log(`
        Early exit. Either e.changeType or source.sheetId() not as expected.
        Type of change: ${thisChange}. Expected 'INSERT_ROW'
        thisSheetID: ${thisSheetID}. Expected ${IMPORT_SHEET_ID}`
      );
      return;
    }

    // Success! Process new valid row...
    processOnChange(thisSource);

  }
  catch (error) {
    console.error(e);
    if (!(error.message).includes('Please select an active sheet first.')) {
      throw new Error(error);
    }
  }
}


/** 
 * Process latest imported attendance submission via McRUN app.
 * 
 * Verifies if import is JSON-formatted string or GSheet multi-column import.
 * 
 * @param {SpreadsheetApp.Sheet} sourceSheet  Sheet with latest submission.
 * 
 * @author [Andrey Gonzalez](<andrey.gonzalez@mail.mcgill.ca>)
 * @date  Feb 10, 2025
 * @update  Feb 10, 2025
 * 
 */

function processOnChange(sourceSheet) {
  const thisLastRow = sourceSheet.getLastRow();
  const thisColSize = sourceSheet.getLastColumn();
  const latestImport = sourceSheet.getRange(thisLastRow, 1, 1, thisColSize).getValues()[0];   // Get last row

  let submissionStr;

  // Case 1: JSON-formatted import (single-column)
  if (latestImport[1] === "") {
    console.log("Entered case 1 in onChange()!", `thisLastRow: ${thisLastRow}`);
    submissionStr = (latestImport[0] !== "") 
      ? latestImport[0] 
      : sourceSheet.getRange(thisLastRow - 1, 1, 1, thisColSize).getValues()[0];    // Try with second-last row
  }

  // Case 2: Multi-column import (e.g., from Zapier)
  else {
    console.log("Entered case 2 in `onChange()`!");
    const keys = sourceSheet.getRange(1, 1, 1, thisColSize).getValues()[0];  // Get header row
    submissionStr = packageAttendance(keys, latestImport);
  }

  const attendanceObj = JSON.parse(submissionStr)
  const lastSemesterRow = copyToSemesterSheet(attendanceObj);
  
  // TRIGGER MAINTENANCE FUNCTIONS
  if((attendanceObj['platform']).toLowerCase() === 'mcrun app'){
    console.log("Entering onAppSubmission() now...");
    onAppSubmission(lastSemesterRow);
  }

}


function transferThisRow(row) {
  const registrationObj = IMPORT_SHEET.getRange(row, 1).getValue();
  const latestSemesterRow = copyToSemesterSheet(registrationObj);
  onFormSubmit(latestSemesterRow);
}

function transferLastImport() {
  const thisLastRow = IMPORT_SHEET.getLastRow();
  transferThisRow(thisLastRow);
}


/** 
 * Transfer new attendance submission from `Import` to semester sheet.
 * 
 * @param {Object<JSON>} attendanceJSON   Attendance information as JSON object.
 * 
 * @param {integer} [row=getLastSubmission()]  Target row in `Attendance_Sheet`.
 * 
 * @return {integer}  Latest row in `Attendance_Sheet`.
 * 
 * @author [Andrey Gonzalez](<andrey.gonzalez@mail.mcgill.ca>)
 * @date  Feb 8, 2025
 * @update  Feb 9, 2025
 * 
 */

function copyToSemesterSheet(attendanceJSON, row=ATTENDANCE_SHEET.getLastRow()) {
  const attendanceSheet = ATTENDANCE_SHEET;
  const importMap = IMPORT_MAP;

  const startRow = row + 1;
  const colSize = attendanceSheet.getLastColumn();

  const valuesByIndex = Array(colSize);   // Array.length = colSize

  // Format timestamp correctly and replace
  const timestampValue = attendanceJSON['timestamp'];
  attendanceJSON['timestamp'] = formatTimestamp(timestampValue);

  for (const [key, value] of Object.entries(attendanceJSON)) {
    if (key in importMap) {
      let indexInMain = importMap[key] - 1;   // Set 1-index to 0-index for `setValues()`
      let holder = String(value).replace(/,+\s*$/, '');   // Remove trailing commas and spaces
      valuesByIndex[indexInMain] = holder.replace(/;/g, '\n');    // Replace semi-colon with newline
    }
  }

  // Process attendees for all run levels
  const attendeeMap = {
    'beginner': ATTENDEES_BEGINNER_COL,
    //'easy': ATTENDEES_BEGINNER_COL,
    'intermediate': ATTENDEES_INTERMEDIATE_COL,
    'advanced':  ATTENDEES_ADVANCED_COL,
  };

  // Get formatted runLevel and attendees value by index
  const runLevelIndex = importMap['runLevel'] - 1;
  const runLevel = (valuesByIndex[runLevelIndex]).toLowerCase();

  const attendeeIndex = importMap['attendees'] - 1;
  const attendees = valuesByIndex[attendeeIndex];

  for (const [level, levelIndex] of Object.entries(attendeeMap)) {
    const arrIndex = levelIndex - 1;   // Transform 1-index to 0-index for array
    valuesByIndex[arrIndex] = (runLevel === level) ? attendees : EMPTY_ATTENDEE_FLAG;
  }

  // Set values of registration
  const rangeToImport = attendanceSheet.getRange(startRow, 1, 1, colSize);
  rangeToImport.setValues([valuesByIndex]);

  return startRow;
}


/** 
 * Create JSON-formatted string of key-value pairs for attendance submission.
 * 
 * @param {string[]} keyArr  Array of keys storing header row values.
 * 
 * @param {string[]} valArr  Values of attendance submission to map.
 * 
 * @return {string}  A JSON string of attendance submission as key-value pairs.
 * 
 * @author [Andrey Gonzalez](<andrey.gonzalez@mail.mcgill.ca>)
 * @date  Feb 9, 2025
 * @update  Feb 9, 2025
 * 
 */

function packageAttendance(keyArr, valArr) {
  if (keyArr.length !== valArr.length) {
    const errMessage = `keyArr and valArr must have the same length.
      keyArr: ${keyArr}
      valArr: ${valArr}`
    ;
    throw new Error(errMessage);
  }

  // Create JSON string
  const obj = Object.fromEntries(keyArr.map((key, i) => [key, valArr[i]]));
  return JSON.stringify(obj);
}


/** 
 * Format timestamp to format as `yyyy-MM-dd hh:mm:ss`.
 * 
 * Raw format cannot be understood by GSheet.
 * 
 * @param {string} raw  Datetime value to be formatted.
 * 
 * @return {Date}  A Date object with correct format.
 * 
 * @author [Andrey Gonzalez](<andrey.gonzalez@mail.mcgill.ca>)
 * @date  Feb 9, 2025
 * @update  Feb 9, 2025
 * 
 */

function formatTimestamp(raw) {
  return Utilities.formatDate(
    new Date(raw), 
    TIMEZONE, 
    'yyyy-MM-dd hh:mm:ss'
  );
}

