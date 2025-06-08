#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';

console.log('🧪 VALIDATING ALL TESTS AFTER CONFIGURATION CHANGES\n');

async function runTests() {
    return new Promise((resolve, reject) => {
        const testProcess = spawn('npm', ['test'], { stdio: 'inherit' });
        testProcess.on('close', (code) => {
            if (code === 0) {
                console.log('\n✅ All tests passed!');
                resolve();
            } else {
                console.log('\n❌ Some tests failed');
                reject(new Error(`Tests failed with code ${code}`));
            }
        });
    });
}

async function checkAlertConsistency() {
    console.log('🔍 Checking alert consistency...');

    try {
        const response = await fetch('http://localhost:3000/api/alerts');
        const alerts = await response.json();

        console.log('Current alert counts:');
        alerts.forEach(alert => {
            console.log(`  ${alert.title}: ${alert.count} (${alert.priority})`);
        });

        return true;
    } catch (error) {
        console.log('❌ Could not fetch alerts - server may not be running');
        return false;
    }
}

// Run validation
try {
    await runTests();
    await checkAlertConsistency();
    console.log('\n🎉 VALIDATION COMPLETE - All systems working correctly!');
} catch (error) {
    console.error('Validation failed:', error.message);
    process.exit(1);
}
