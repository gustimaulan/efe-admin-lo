function sendPostRequestLoops(timeOfDay) {
  var url = "http://5.161.185.120:3010/api/run";
  var formData = getSelectedAdminValues(timeOfDay);
  formData["timeOfDay"] = timeOfDay;

  // Use BrowserCat (remote) for pagi, local for everything else
  formData["browserType"] = (timeOfDay === 'pagi') ? 'remote' : 'local';

  var options = {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: formData,
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    Logger.log(`${timeOfDay} Response Code: ${responseCode}`);
    Logger.log(`${timeOfDay} Response Body: ${response.getContentText()}`);

    var finishTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });

    // Extract admin values from formData
    var adminValues = [];
    for (var key in formData) {
      if (key.startsWith('admin')) {
        adminValues.push(formData[key]);
      }
    }

    // Send webhook notification
    if (adminValues.length > 0) {
      sendWebhookNotification(adminValues, timeOfDay);
    }

    return response.getContentText();
  } catch (error) {
    Logger.log(`${timeOfDay} Error: ${error.toString()}`);

    var finishTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });

    // Extract admin values from formData for failure case
    var adminValues = [];
    for (var key in formData) {
      if (key.startsWith('admin')) {
        adminValues.push(formData[key]);
      }
    }

    // Send webhook notification for failure
    if (adminValues.length > 0) {
      sendWebhookNotification(adminValues, timeOfDay);
    }

    return "Error: " + error.toString();
  }
}

function sendPostRequestOy(values, timeOfDay) {
  var url = "https://oy.solusiexcel.com/run";
  //var url = "https://oy.efeindonesia.id/run";
  var processedValues = values.map(val => (val === true ? 1 : val === false ? 0 : val));
  var formData = processedValues.map((val, index) => `values=${encodeURIComponent(val)}`).join("&");
  var options = { method: "post", contentType: "application/x-www-form-urlencoded", payload: formData, muteHttpExceptions: true };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    Logger.log(`${timeOfDay} Response Code: ${responseCode}`);
    Logger.log(`${timeOfDay} Response Body: ${response.getContentText()}`);

    var finishTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });

    Logger.log(`✅ Successfully sent values [${processedValues.join(", ")}] on ${timeOfDay} at ${finishTime}`);

    return response.getContentText();
  } catch (error) {
    Logger.log(`${timeOfDay} Error: ${error.toString()}`);

    var finishTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });

    Logger.log(`❌ Failed to send values [${processedValues.join(", ")}] on ${timeOfDay} at ${finishTime}: ${error.toString()}`);

    return "Error: " + error.toString();
  }
}

/**
 * Gets selected admin values with dynamic admin keys
 * Finds all TRUE values in the row and creates admin1, admin2, admin3, etc. keys
 * Restrictions are now handled by server config - no exclusion parameters needed
 * @param {string} timeOfDay - The time period (pagi, siang, malam, manual)
 * @returns {Object} - Form data with dynamic admin keys
 */
function getSelectedAdminValues(timeOfDay) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet2");
  const rowMap = {
    "pagi": 2,
    "siang": 3,
    "malam": 4,
    "manual": 5
  };

  const headerRange = sheet.getRange("A1:K1");
  const rawHeaders = headerRange.getValues()[0];
  const headers = rawHeaders.map(header => `admin ${header}`);

  const dataRange = sheet.getRange(`A${rowMap[timeOfDay]}:K${rowMap[timeOfDay]}`);
  const values = dataRange.getValues()[0];

  let formData = { "requestTime": timeOfDay };
  let adminCount = 0;

  // Collect ALL selected admins - server will handle restrictions via config
  let selectedAdmins = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] === true) {
      selectedAdmins.push(headers[i]);
    }
  }

  Logger.log(`${timeOfDay}: Selected admins from spreadsheet: ${selectedAdmins.join(', ')}`);
  Logger.log(`${timeOfDay}: Server will apply config-based restrictions automatically`);

  // Create form data with ALL selected admins
  for (let i = 0; i < selectedAdmins.length; i++) {
    adminCount++;
    formData[`admin${adminCount}`] = selectedAdmins[i];
  }

  // If no admins were selected, provide admin 3 as default
  if (adminCount === 0) {
    formData["admin1"] = "admin 3";
    Logger.log(`${timeOfDay}: No admins selected, defaulting to admin 3`);
  }

  return formData;
}

function getValuesFromSpreadsheetOy(cellRange) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet2");
  return sheet.getRange(cellRange).getValues()[0];
}

function sendPostRequestLoopsPagi() {
  return sendPostRequestLoops("pagi");
}

function sendPostRequestLoopsSiang() {
  return sendPostRequestLoops("siang");
}

function sendPostRequestLoopsMalam() {
  return sendPostRequestLoops("malam");
}

function sendPostRequestOyPagi() {
  const values = getValuesFromSpreadsheetOy("A2:K2").map(val => (isNaN(Number(val)) ? 0 : Number(val)));
  return sendPostRequestOy(values, "pagi");
}

function sendPostRequestOySiang() {
  const values = getValuesFromSpreadsheetOy("A3:K3").map(val => (isNaN(Number(val)) ? 0 : Number(val)));
  return sendPostRequestOy(values, "siang");
}

function sendPostRequestOyMalam() {
  const values = getValuesFromSpreadsheetOy("A4:K4").map(val => (isNaN(Number(val)) ? 0 : Number(val)));
  return sendPostRequestOy(values, "malam");
}

function setupFixedTriggersAll() {
  clearAllTriggers();

  const now = new Date();
  // RegulerLo
  ScriptApp.newTrigger('sendPostRequestLoopsPagi').timeBased().at(new Date(now.setHours(21, 30, 0, 0))).create(); // Pagi
  ScriptApp.newTrigger('sendPostRequestLoopsSiang').timeBased().at(new Date(now.setHours(12, 30, 0, 0))).create(); // Siang
  ScriptApp.newTrigger('sendPostRequestLoopsMalam').timeBased().at(new Date(now.setHours(17, 0, 0, 0))).create(); // Malam
  // RegulerOy
  // ScriptApp.newTrigger('sendPostRequestOyPagi').timeBased().at(new Date(now.setHours(21, 40, 0, 0))).create();
  // ScriptApp.newTrigger('sendPostRequestOySiang').timeBased().at(new Date(now.setHours(12, 30, 0, 0))).create();
  // ScriptApp.newTrigger('sendPostRequestOyMalam').timeBased().at(new Date(now.setHours(17, 0, 0, 0))).create();

  Logger.log("All precise triggers have been set up successfully");
}

function clearAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() !== "dailyTriggerSetup") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  Logger.log("All triggers except dailyTriggerSetup have been deleted");
}

function dailyTriggerSetup() {
  setupFixedTriggersAll();
}

// Test Snippet
function testAdminValuesAndProcess() {
  const timePeriods = ["pagi", "siang", "malam", "manual"];

  timePeriods.forEach(timeOfDay => {
    Logger.log(`\nTesting ${timeOfDay}...`);

    // Get admin values
    var formData = getSelectedAdminValues(timeOfDay);

    // Log all admin values
    Logger.log(`TimeOfDay: ${timeOfDay}`);
    Logger.log(`Form Data: ${JSON.stringify(formData)}`);

    // Log each admin separately for readability
    for (var key in formData) {
      if (key.startsWith('admin')) {
        Logger.log(`${key}: ${formData[key]}`);
      }
    }

    Logger.log(`${timeOfDay}: Config-based restrictions will be applied by server`);
  });

  Logger.log("\nAll tests completed!");
}

function sendWebhookNotification(adminNames, timeOfDay) {
  const payload = {
    admins: adminNames,
    timeOfDay: timeOfDay
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log('Webhook notification sent');
    return response.getContentText();
  } catch (error) {
    Logger.log('Webhook error: ' + error.toString());
    return 'Error sending webhook notification: ' + error.toString();
  }
}

/**
 * Test function to demonstrate form submission with config-based restrictions
 * Shows exactly what would be sent to the server with new restriction system
 */
function testFormSubmissionMimicking() {
  Logger.log("=== TESTING FORM SUBMISSION WITH CONFIG-BASED RESTRICTIONS ===");
  Logger.log("All selected admins sent to server, restrictions handled by config.js\n");

  const timePeriods = ["pagi", "siang", "malam"];

  timePeriods.forEach(timeOfDay => {
    Logger.log(`\n--- ${timeOfDay.toUpperCase()} ---`);

    // Get the form data (this mimics what would be sent to server)
    const formData = getSelectedAdminValues(timeOfDay);

    // Show original selections from spreadsheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet2");
    const rowMap = { "pagi": 2, "siang": 3, "malam": 4 };
    const headerRange = sheet.getRange("A1:K1");
    const rawHeaders = headerRange.getValues()[0];
    const headers = rawHeaders.map(header => `admin ${header}`);
    const dataRange = sheet.getRange(`A${rowMap[timeOfDay]}:J${rowMap[timeOfDay]}`);
    const values = dataRange.getValues()[0];

    const originalSelections = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === true) {
        originalSelections.push(headers[i]);
      }
    }

    Logger.log(`Spreadsheet selections: ${originalSelections.join(', ')}`);

    // Show what gets sent to server
    const adminKeys = Object.keys(formData).filter(key => key.startsWith('admin'));
    const finalAdmins = adminKeys.map(key => formData[key]);
    Logger.log(`ALL admins sent to server: ${finalAdmins.join(', ')}`);

    // Show current restriction behavior
    Logger.log(`🔸 Server applies config-based restrictions:`);
    Logger.log(`   • Admin 1: Can only process campaign 247001`);
    Logger.log(`   • Admin 2, 10: Cannot process campaign 247001`);
    Logger.log(`   • All other admins: Process all available campaigns`);

    // Show the complete form data
    Logger.log(`\nComplete form data sent:`);
    Logger.log(`- timeOfDay: ${formData.timeOfDay || timeOfDay}`);

    adminKeys.forEach(key => {
      Logger.log(`- ${key}: ${formData[key]}`);
    });

    Logger.log(`\n${'='.repeat(50)}`);
  });

  Logger.log("\n✅ Config-based restriction test completed!");
  Logger.log("All restrictions are now handled by server config.js");
}

/**
 * Quick test to verify current admin values are being read
 */
function testCurrentAdminValues() {
  const timeOfDay = "pagi"; // Change this to test different times
  const formData = getSelectedAdminValues(timeOfDay);

  Logger.log(`Current time: ${new Date()}`);
  Logger.log(`Testing ${timeOfDay} - Current admin values:`);

  for (const key in formData) {
    if (key.startsWith('admin')) {
      Logger.log(`${key}: ${formData[key]}`);
    }
  }

  Logger.log("Server will apply config-based restrictions automatically");

  return formData;
}