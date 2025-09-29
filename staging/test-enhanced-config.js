// Test file untuk menguji sistem konfigurasi baru
const enhancedConfig = require('./config-more-enhanced.js');

console.log('Testing Enhanced Configuration System\n');

// Fungsi untuk menjalankan test
function runTest(testName, expected, actual) {
    const passed = expected === actual;
    console.log(`${testName}: ${passed ? '✅ PASS' : '❌ FAIL'} (Expected: ${expected}, Actual: ${actual})`);
    return passed;
}

let testsPassed = 0;
let totalTests = 0;

// Test 1: Admin 10 tidak bisa memproses kampanye 247001
totalTests++;
if (runTest('Admin 10 cannot process campaign 247001', false, enhancedConfig.canAdminProcessCampaign('admin 10', 247001, []))) {
    testsPassed++;
}

// Test 2: Admin 10 bisa memproses kampanye lain
totalTests++;
if (runTest('Admin 10 can process campaign 247002', true, enhancedConfig.canAdminProcessCampaign('admin 10', 247002, []))) {
    testsPassed++;
}

// Test 3: Admin 1 hanya bisa memproses kampanye 247001
totalTests++;
if (runTest('Admin 1 can only process campaign 247001', false, enhancedConfig.canAdminProcessCampaign('admin 1', 247002, []))) {
    testsPassed++;
}

totalTests++;
if (runTest('Admin 1 can process campaign 247001', true, enhancedConfig.canAdminProcessCampaign('admin 1', 247001, []))) {
    testsPassed++;
}

// Test 4: Admin 5 bisa proses semua kampanye jika admin 91 tidak dipilih
totalTests++;
if (runTest('Admin 5 can process campaign 247002 without admin 91', true, enhancedConfig.canAdminProcessCampaign('admin 5', 247002, ['admin 5']))) {
    testsPassed++;
}

// Test 5: Admin 5 hanya bisa memproses kampanye 247001 jika admin 91 dipilih
totalTests++;
if (runTest('Admin 5 restricted when admin 91 present', false, enhancedConfig.canAdminProcessCampaign('admin 5', 247002, ['admin 5', 'admin 91']))) {
    testsPassed++;
}

totalTests++;
if (runTest('Admin 5 can process campaign 247001 when admin 91 present', true, enhancedConfig.canAdminProcessCampaign('admin 5', 247001, ['admin 5', 'admin 91']))) {
    testsPassed++;
}

// Test 6: Pengecualian admin 5 ketika semua admin spesial dipilih
totalTests++;
if (runTest('Admin 5 exempt when all special admins present', true, enhancedConfig.canAdminProcessCampaign('admin 5', 247002, ['admin 1', 'admin 5', 'admin 91']))) {
    testsPassed++;
}

// Test 7: Admin 91 tidak bisa memproses kampanye 247001
totalTests++;
if (runTest('Admin 91 cannot process campaign 247001', false, enhancedConfig.canAdminProcessCampaign('admin 91', 247001, []))) {
    testsPassed++;
}

// Test 8: Admin 92 tidak bisa memproses kampanye 247001
totalTests++;
if (runTest('Admin 92 cannot process campaign 247001', false, enhancedConfig.canAdminProcessCampaign('admin 92', 247001, []))) {
    testsPassed++;
}

// Test 9: Admin 7 hanya bisa memproses 247001 ketika admin 92 dipilih
totalTests++;
if (runTest('Admin 7 restricted when admin 92 present', false, enhancedConfig.canAdminProcessCampaign('admin 7', 247002, ['admin 7', 'admin 92']))) {
    testsPassed++;
}

totalTests++;
if (runTest('Admin 7 can process campaign 247001 when admin 92 present', true, enhancedConfig.canAdminProcessCampaign('admin 7', 247001, ['admin 7', 'admin 92']))) {
    testsPassed++;
}

// Test 10: Filter admin untuk kampanye
totalTests++;
const filteredAdmins1 = enhancedConfig.getAdminsForCampaign(['admin 5', 'admin 91'], 247002, {});
const expectedFiltered1 = ['admin 91']; // Admin 5 tidak bisa karena admin 91 ada
const test10Passed = JSON.stringify(filteredAdmins1) === JSON.stringify(expectedFiltered1);
runTest('Filter admins for campaign 247002 with admin 5 and 91', expectedFiltered1.join(','), filteredAdmins1.join(','));
if (test10Passed) testsPassed++;

// Test 11: Filter admin untuk kampanye tanpa pembatasan
totalTests++;
const filteredAdmins2 = enhancedConfig.getAdminsForCampaign(['admin 1', 'admin 2', 'admin 3'], 247002, {});
const expectedFiltered2 = ['admin 2', 'admin 3']; // Admin 1 tidak bisa karena hanya bisa 247001
const test11Passed = JSON.stringify(filteredAdmins2) === JSON.stringify(expectedFiltered2);
runTest('Filter admins for campaign 247002 with admin 1,2,3', expectedFiltered2.join(','), filteredAdmins2.join(','));
if (test11Passed) testsPassed++;

console.log(`\nTest Results: ${testsPassed}/${totalTests} tests passed`);

if (testsPassed === totalTests) {
    console.log('🎉 All tests passed! The enhanced configuration system is working as expected.');
} else {
    console.log('⚠️ Some tests failed. Please review the configuration.');
}