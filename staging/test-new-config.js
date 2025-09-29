// Test file untuk menguji sistem konfigurasi baru dengan payload structure
const config = require('./config-enhanced.js');

console.log('Testing New Configuration System with Payload Structure\n');

// Fungsi untuk menjalankan test
function runTest(testName, expected, actual) {
    const passed = expected === actual;
    console.log(`${testName}: ${passed ? '✅ PASS' : '❌ FAIL'} (Expected: ${expected}, Actual: ${actual})`);
    return passed;
}

let testsPassed = 0;
let totalTests = 0;

// Use staging campaign IDs: 289626 and 289627
// 289627 adalah campaign lanjutan seperti 247001 di reguler

// Test 1: Admin dengan ruleType include dan campaignId yang cocok
totalTests++;
const adminPayload1 = { name: "admin 1", ruleType: "include", campaignId: "289627" };
const result1 = config.processAdminRules(adminPayload1, 289627);
if (runTest('Admin dengan include rule untuk campaign yang cocok', true, result1)) {
    testsPassed++;
}

// Test 2: Admin dengan ruleType include dan campaignId yang tidak cocok
totalTests++;
const adminPayload2 = { name: "admin 2", ruleType: "include", campaignId: "289627" };
const result2 = config.processAdminRules(adminPayload2, 289626);
if (runTest('Admin dengan include rule untuk campaign yang tidak cocok', false, result2)) {
    testsPassed++;
}

// Test 3: Admin dengan ruleType exclude dan campaignId yang cocok
totalTests++;
const adminPayload3 = { name: "admin 3", ruleType: "exclude", campaignId: "289627" };
const result3 = config.processAdminRules(adminPayload3, 289627);
if (runTest('Admin dengan exclude rule untuk campaign yang cocok', false, result3)) {
    testsPassed++;
}

// Test 4: Admin dengan ruleType exclude dan campaignId yang tidak cocok
totalTests++;
const adminPayload4 = { name: "admin 4", ruleType: "exclude", campaignId: "289627" };
const result4 = config.processAdminRules(adminPayload4, 289626);
if (runTest('Admin dengan exclude rule untuk campaign yang tidak cocok', true, result4)) {
    testsPassed++;
}

// Test 5: Admin dengan ruleType dan campaignId null (bisa semua campaign)
totalTests++;
const adminPayload5 = { name: "admin 5", ruleType: null, campaignId: null };
const result5 = config.processAdminRules(adminPayload5, 289627);
if (runTest('Admin dengan rule null bisa semua campaign (test 1)', true, result5)) {
    testsPassed++;
}

totalTests++;
const result5b = config.processAdminRules(adminPayload5, 289626);
if (runTest('Admin dengan rule null bisa semua campaign (test 2)', true, result5b)) {
    testsPassed++;
}

// Test 6: Admin tanpa ruleType (default behavior)
totalTests++;
const adminPayload6 = { name: "admin 6", ruleType: undefined, campaignId: undefined };
const result6 = config.processAdminRules(adminPayload6, 289627);
if (runTest('Admin tanpa ruleType bisa semua campaign', true, result6)) {
    testsPassed++;
}

// Test 7: canAdminProcessCampaign function dengan payload
totalTests++;
const allPayloads = [
    { name: "admin 1", ruleType: "include", campaignId: "289627" },
    { name: "admin 2", ruleType: "exclude", campaignId: "289627" },
    { name: "admin 3", ruleType: null, campaignId: null }
];
const result7 = config.canAdminProcessCampaign("admin 1", 289627, allPayloads);
if (runTest('canAdminProcessCampaign - admin 1 include campaign 289627', true, result7)) {
    testsPassed++;
}

// Test 8: canAdminProcessCampaign function dengan payload yang tidak cocok
totalTests++;
const result8 = config.canAdminProcessCampaign("admin 1", 289626, allPayloads);
if (runTest('canAdminProcessCampaign - admin 1 tidak include campaign 289626', false, result8)) {
    testsPassed++;
}

// Test 9: canAdminProcessCampaign function dengan exclude rule
totalTests++;
const result9 = config.canAdminProcessCampaign("admin 2", 289627, allPayloads);
if (runTest('canAdminProcessCampaign - admin 2 exclude campaign 289627', false, result9)) {
    testsPassed++;
}

// Test 10: canAdminProcessCampaign function dengan exclude rule yang tidak cocok
totalTests++;
const result10 = config.canAdminProcessCampaign("admin 2", 289626, allPayloads);
if (runTest('canAdminProcessCampaign - admin 2 tidak exclude campaign 289626', true, result10)) {
    testsPassed++;
}

// Test 11: canAdminProcessCampaign function dengan null rules (bisa semua)
totalTests++;
const result11 = config.canAdminProcessCampaign("admin 3", 289627, allPayloads);
if (runTest('canAdminProcessCampaign - admin 3 null rules campaign 289627', true, result11)) {
    testsPassed++;
}

// Test 12: getAdminsForCampaign function
totalTests++;
const result12 = config.getAdminsForCampaign(allPayloads, 289627);
const expected12 = ["admin 1", "admin 3"];
const test12Passed = JSON.stringify(result12.sort()) === JSON.stringify(expected12.sort());
runTest('getAdminsForCampaign - campaign 289627', expected12.join(','), result12.join(','));
if (test12Passed) testsPassed++;

// Test 13: getAdminsForCampaign function untuk campaign yang tidak di-include
totalTests++;
const result13 = config.getAdminsForCampaign(allPayloads, 289626);
const expected13 = ["admin 2", "admin 3"];
const test13Passed = JSON.stringify(result13.sort()) === JSON.stringify(expected13.sort());
runTest('getAdminsForCampaign - campaign 289626', expected13.join(','), result13.join(','));
if (test13Passed) testsPassed++;

console.log(`\nTest Results: ${testsPassed}/${totalTests} tests passed`);

if (testsPassed === totalTests) {
    console.log('🎉 All tests passed! The new configuration system with payload structure is working as expected.');
} else {
    console.log('⚠️ Some tests failed. Please review the configuration.');
}