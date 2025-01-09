/**
 * Appends email to attendee name if found. Otherwise, do not add to name.
 * 
 * Loops through all levels found in `row`. Sets new cell values in the end.
 * 
 * @param {integer} row  Row in `ATTENDANCE_SHEET` to append email.
 * @param {string[][]} memberMap  All search keys of registered members (sorted) and emails.
 * 
 * @author [Andrey Gonzalez](<andrey.gonzalez@mail.mcgill.ca>) & ChatGPT
 * @date  Dec 14, 2024
 * @update  Dec 14, 2024
 */

function appendMemberEmail(row, memberMap) {
  const sheet = ATTENDANCE_SHEET;
  const numRowToGet = 1;
  const numColToGet = LEVEL_COUNT;

  // Get attendee range starting from beginner col to advanced col
  const attendeeRange = sheet.getRange(row, ATTENDEES_BEGINNER_COL, numRowToGet, numColToGet);  // Attendees columns

  const allAttendees = attendeeRange.getValues()[0]; // Single row of attendees
  const updatedAttendees = [];    // Resulting values to set in sheet

  // Iterate through levels and add emails
  for(let col=0; col < numColToGet; col++) {
    let attendeesInLevel = allAttendees[col]
      .split('\n')  // Split by newline
    ;

    // Skip levels with no attendees
    if(attendeesInLevel.includes("None")) {
      updatedAttendees.push("None");
      continue;
    }

    const memberSearchKey = memberMap[index][SEARCH_KEY_INDEX];
    

    // Compare last names and check if first name matches any in the list
    if (attendeeLastName === memberLastName && searchFirstNameList.includes(attendeeFirstName)) {return;}
      

    // Format each attendee with their email if available



    const formattedAttendee = attendeesInLevel.map(name => {

      const [memberLastName, memberFirstNames] = memberSearchKey.split(",").map(s => s.trim());
      const searchFirstNameList = memberFirstNames.split("|").map(s => s.trim());   // only if preferredName exists

      if (name in memberMap) {
        return `${name}:${memberMap[name]}`;
      }
      return name; // Leave the name as-is if no email found
    });

    // Join back into a string and add to the results
    updatedAttendees.push(formattedAttendee.join('\n'));
  }

  // Write the updated attendees back to the sheet
  attendeeRange.setValues([updatedAttendees]);
}


function hideAllAttendeeEmail() {
  const sheet = ATTENDANCE_SHEET;
  const startRow = 2  // Skip header row
  const numRows = sheet.getLastRow() - 1;   // Remove header row from count
  const endRow = startRow + numRows;

  for(var row = startRow; row < endRow; row++) {
    hideAttendeeEmailInRow_(row);
  }
}


function hideAttendeeEmailInRow_(row=ATTENDANCE_SHEET.getLastRow()) {
  const allAttendeesCol = [
    ATTENDEES_BEGINNER_COL, 
    ATTENDEES_INTERMEDIATE_COL, 
    ATTENDEES_ADVANCED_COL
  ];

  allAttendeesCol.forEach(col => hideAttendeeEmailInCell_(col, row));
}


function hideAttendeeEmailInCell_(column, row=ATTENDANCE_SHEET.getLastRow()) {
  const sheet = ATTENDANCE_SHEET;
  const lastRow = ATTENDANCE_SHEET.getLastRow();

  const attendeeRange = sheet.getRange(row, column);
  const cellValue = attendeeRange.getValue();

  if(cellValue == "None") return;   // No attendees for this level

  // Get the cell's background color
  const banding = attendeeRange.getBandings()[0];   // Only 1 banding
  const bandingColours = {
    'colourEvenRow': banding.getFirstRowColorObject(),
    'colourOddRow' : banding.getSecondRowColorObject(),
    'colourFooter' : banding.getFooterRowColorObject(),

    getColour : function(row) {
      if(row == lastRow)     {return this.colourFooter}
      else if(row % 2 == 0)  {return this.colourEvenRow}
      else                   {return this.colourOddRow}
    }
  }

  let cellBackgroundColour = bandingColours.getColour(row);

  // Create a RichTextValueBuilder for the cell
  const richTextBuilder = SpreadsheetApp.newRichTextValue().setText(cellValue);
  const isRegisteredTextStyle = SpreadsheetApp.newTextStyle()
    .setItalic(true)
    .setForegroundColorObject(cellBackgroundColour)
    .build()
  ;
  const isUnregisteredTextStyle = SpreadsheetApp.newTextStyle()
    .setForegroundColor('red')
    .build()
  ;

  // Split the cell value by line breaks
  const lines = cellValue.split("\n");

  // Iterate through each line and format the email portion
  let currentIndex = 0;
  const delimiter = ":";
  
  for (const line of lines) {
    const delimiterIndex = line.indexOf(delimiter);
    
    if(delimiterIndex !== -1) {
      // Find the email (after the delimiter)
      const email = line.substring(delimiterIndex + 1).trim();
      if(email) {
        const start = currentIndex + delimiterIndex; // Start index of delimiter
        const end = start + email.length + 1; // End index of the email

        // Apply text color and italic formatting to the email
        richTextBuilder.setTextStyle(start, end, isRegisteredTextStyle);
      }
    }
    else {
      const start = currentIndex;
      const end = start + line.length + (line.includes('\n') ? 1 : 0);
      richTextBuilder.setTextStyle(start, end, isUnregisteredTextStyle);
    }
    // Update currentIndex to account for the line length and newline character
    currentIndex += line.length + 1;
  }

  // Build and set the RichTextValue for the cell
  const richTextValue = richTextBuilder.build();
  attendeeRange.setRichTextValue(richTextValue);
}


function transferSubmissionToLedger(row=ATTENDANCE_SHEET.getLastRow()) {
  const sheet = ATTENDANCE_SHEET;
  
  // `Points Ledger` Google Sheet
  const sheetURL = LEDGER_URL;
  const ss = SpreadsheetApp.openByUrl(sheetURL);
  const ledgerSheet = ss.getSheetByName(LEDGET_SHEET_NAME);
  var ledgerLastRow = ledgerSheet.getLastRow();   // Increment per event transfer

  // Select columns to transfer from `sheet`
  const startCol = EMAIL_COL;
  const numCol = DISTANCE_COL - EMAIL_COL + 1;  // GSheet is 1-indexed
  const numRow = 1;

  // Range is `EMAIL_COL` to `DISTANCE_COL`
  rangeSubmission = sheet.getRange(row, startCol, numRow, numCol);

  // Save values in 0-indexed array, then transform into 1-indexed by appending empty
  // string to the front. Now, access is easier e.g [EMAIL_COL] vs [EMAIL_COL-1]
  const values = rangeSubmission.getValues()[0];
  values.unshift("");   // append "" to front

  const formattedNow = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm');

  const allAttendeesCol = [
    ATTENDEES_BEGINNER_COL, 
    ATTENDEES_INTERMEDIATE_COL, 
    ATTENDEES_ADVANCED_COL
  ].filter(level => !values[level].includes("None")) // Skip levels with "None"
 
  for(var level of allAttendeesCol) {
    
    // Format in `Event Log` sheet in `Points Ledger`
    // Import-Timestamp   Event   Event-TS   MemberEmail   Distance   Points
    const eventToTransfer = [
      formattedNow,           // Import Timestamp
      values[HEADRUN_COL],    // Event name
      values[TIMESTAMP_COL],  // Event Timestamp
      attendees,              // Member Emails
      values[DISTANCE_COL],   // Distance
      // Note: Points added in `Points Ledger`
    ]

    const rangeNewLog = ledgerSheet.getRange(ledgerLastRow++, 1);
    rangeNewLog.setValues([eventToTransfer]);
  }
  
}



/**
 * Function to send email to each member updating them on their points
 * 
 * @trigger The 1st and 14th of every month
 * 
 * @author [Charles Villegas](<charles.villegas@mail.mcgill.ca>) & ChatGPT
 * @date  Nov 5, 2024
 * @update  Nov 5, 2024
 */

function pointsEmail() {
  const sheet = ATTENDANCE_SHEET;
  const lastRow = sheet.getLastRow();

  // if (getCurrentUserEmail() != 'mcrunningclub@ssmu.ca') return;   // prevent email sent by wrong user

  const points = SpreadsheetApp.openByUrl(LEDGER_URL).getSheetByName("Member Points");

  // Define the columns to check for attendees
  const attendeeColumns = [
    ATTENDEES_BEGINNER_COL, 
    ATTENDEES_INTERMEDIATE_COL, 
    ATTENDEES_ADVANCED_COL
  ];

  // Collect all unique values in one step
  const uniqueRecipients = new Set(
    attendeeColumns.flatMap(level => {
      // Get all values in the current column and split by newline
      return sheet.getRange(2, level, lastRow, 1).getValues()
        .flat() // Flatten the 2D array to 1D
        .map(value => value.split('\n')) // Split by newline
        .flat(); // Flatten the nested arrays
    })
  );

  // Convert the Set to an Array of unique recipients
  const uniqueRecipientsArray = [...uniqueRecipients].map(value => value.trim()).filter(Boolean);

  // Get all names and point values from points, and names and emails from emails
  const pointsData = points.getRange(2, 2, points.getLastRow() - 1, 6).getValues();
  
  // Create a mapping of full names to points
  const pointsMap = {};
  pointsData.forEach(([email, , , , fullName, points]) => {
    pointsMap[fullName.trim()] = [email, points]; // Store points with full name as the key
  });

  let count = 0

  // Loop through the full names array and email that member regarding their current points
  uniqueRecipientsArray.forEach(fullName => {
    const trimmedName = fullName.trim();

    if (!pointsMap[trimmedName]) return;     // skips to next iteration if no email is found
    if (count > 0) return;
    count++;

    const points = pointsMap[trimmedName][1] ?? 0;
    const email = pointsMap[trimmedName][0]; // Get email for the full name
    const firstName = trimmedName.split(" ")[0];

    if (email) {
      // Construct and send the email
      const subject = `Your Points Update`;

      const pointsEmailHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, Helvetica, sans-serif;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 10%;
                text-align: center;
                background-color: white;
                color: black;
              }
            </style>
          </head>
          <body>
            <h1>Hello, ${firstName}!</h1>
            <h3>You currently have:</h3>
            <h2>${points} points</h2>
            <p>Thanks for running with us, hope you keep up the great pace!</p>
            <p>Best, <br>McGill Students Running Club</p>
          </body>
        </html>
      `;
      
      
      MailApp.sendEmail({
        to: "charles.villegas@mail.mcgill.ca",
        subject: subject,
        htmlBody: pointsEmailHTML
      });
      

      // log confirmation for the sent email with values for each variable
      Logger.log(`Email sent to ${trimmedName} at ${email} with ${points} points.`);
    } else {
      Logger.log(`No email found for ${trimmedName}.`);
    }
  });
}

