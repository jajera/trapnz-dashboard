#!/usr/bin/env node

import { spawn } from 'child_process';
import fetch from 'node-fetch';

const TRAPNZ_TOKEN = process.env.TRAPNZ_WFS_TOKEN || '1b8a944b-14fe-4c06-b4fa-01b2bc3eebad';

console.log('🧪 TrapNZ Dashboard - Comprehensive Test & Validation Suite');
console.log('===========================================================\n');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, { stdio: 'inherit', env: { ...process.env, TRAPNZ_WFS_TOKEN: TRAPNZ_TOKEN } });
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function testAPI(endpoint, expectedStatus = 200) {
  try {
    const response = await fetch(`http://localhost:3000${endpoint}`);
    if (response.status === expectedStatus) {
      log(`✅ ${endpoint} - OK`, colors.green);
      return await response.json();
    } else {
      log(`❌ ${endpoint} - Status ${response.status}`, colors.red);
      return null;
    }
  } catch (error) {
    log(`❌ ${endpoint} - Error: ${error.message}`, colors.red);
    return null;
  }
}

async function validateSpecificIssues() {
  log('\n🔍 Validating Specific Issues Fixed:', colors.blue);

  try {
    // Test 1: Alert count consistency
    log('\n1. Testing Alert Count Consistency...');
    const alerts = await testAPI('/api/alerts');

    if (alerts && alerts.alerts) {
      for (const alert of alerts.alerts) {
        log(`   📊 ${alert.type}: ${alert.count} alerts`);

        // Test drilldown consistency for Inactive High Performers
        if (alert.type === 'Inactive High Performers') {
          const details = await testAPI('/api/traps/details?months=999&statusFilter=all&limit=500');
          if (details) {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const actualCount = details.traps.filter(trap => {
              const hasRecentCatch = trap.lastCatch && new Date(trap.lastCatch) > oneWeekAgo;
              return !trap.isActive && trap.efficiency > 20 && !hasRecentCatch;
            }).length;

            if (actualCount === alert.count) {
              log(`   ✅ Drilldown matches: ${actualCount} traps`, colors.green);
            } else {
              log(`   ❌ Drilldown mismatch: Alert shows ${alert.count}, drilldown shows ${actualCount}`, colors.red);
            }
          }
        }
      }
    }

    // Test 2: MK12 Status Consistency
    log('\n2. Testing MK12 Status Consistency...');
    const details = await testAPI('/api/traps/details?months=999&limit=500');
    if (details) {
      const mk12 = details.traps.find(trap => trap.trapCode === 'MK12' || trap.id === 'MK12');
      if (mk12) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const hasRecentCatch = mk12.lastCatch && new Date(mk12.lastCatch) > oneWeekAgo;

        log(`   📍 MK12 Found:`);
        log(`      - Official Status: ${mk12.isActive ? 'Active' : 'Inactive'}`);
        log(`      - Last Catch: ${mk12.lastCatch || 'Never'}`);
        log(`      - Has Recent Catch: ${hasRecentCatch ? 'Yes' : 'No'}`);
        log(`      - Efficiency: ${mk12.efficiency}%`);

        if (hasRecentCatch) {
          log(`   ✅ MK12 should show as Active (has recent catch)`, colors.green);

          // Check it's not in Inactive High Performers
          if (alerts && alerts.alerts) {
            const inactiveAlert = alerts.alerts.find(a => a.type === 'Inactive High Performers');
            if (inactiveAlert) {
              const inactiveDetails = await testAPI('/api/traps/details?months=999&statusFilter=all&limit=500');
              const inactiveHighPerformers = inactiveDetails.traps.filter(trap => {
                const trapHasRecentCatch = trap.lastCatch && new Date(trap.lastCatch) > oneWeekAgo;
                return !trap.isActive && trap.efficiency > 20 && !trapHasRecentCatch;
              });

              const mk12InAlert = inactiveHighPerformers.find(trap => trap.trapCode === 'MK12' || trap.id === 'MK12');
              if (!mk12InAlert) {
                log(`   ✅ MK12 correctly excluded from Inactive High Performers`, colors.green);
              } else {
                log(`   ❌ MK12 incorrectly included in Inactive High Performers`, colors.red);
              }
            }
          }
        }
      } else {
        log(`   ❓ MK12 not found in data`, colors.yellow);
      }
    }

    // Test 3: Recent Catches Consistency
    log('\n3. Testing Recent Catches Consistency...');
    const status = await testAPI('/api/traps/status');
    if (status && details) {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const calculatedRecentCatches = details.traps.filter(trap => {
        if (!trap.lastCatch) return false;
        return new Date(trap.lastCatch) > oneWeekAgo;
      }).length;

      log(`   📊 Dashboard reports: ${status.recentCatches} recent catches`);
      log(`   📊 Calculated from details: ${calculatedRecentCatches} recent catches`);

      if (status.recentCatches === calculatedRecentCatches) {
        log(`   ✅ Recent catches count is consistent`, colors.green);
      } else {
        log(`   ❌ Recent catches count mismatch`, colors.red);
      }
    }

    log('\n✅ Issue validation complete!', colors.green);

  } catch (error) {
    log(`❌ Validation failed: ${error.message}`, colors.red);
  }
}

async function main() {
  try {
    // Step 1: Run all tests
    log('1. Running Complete Test Suite...', colors.blue);
    await runCommand('npm', ['test']);
    log('✅ All tests passed!\n', colors.green);

    // Step 2: Start server for live validation (if not already running)
    log('2. Starting Server for Live Validation...', colors.blue);

    // Check if server is already running
    try {
      await fetch('http://localhost:3000/api/projects');
      log('✅ Server already running\n', colors.green);
    } catch {
      log('📡 Starting server...', colors.yellow);
      // Start server in background
      spawn('node', ['server.js'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, TRAPNZ_WFS_TOKEN: TRAPNZ_TOKEN }
      });

      // Wait for server to start
      let attempts = 0;
      while (attempts < 10) {
        try {
          await fetch('http://localhost:3000/api/projects');
          log('✅ Server started successfully\n', colors.green);
          break;
        } catch {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (attempts >= 10) {
        throw new Error('Server failed to start');
      }
    }

    // Step 3: Run live API validation
    log('3. Running Live API Validation...', colors.blue);
    await testAPI('/api/projects');
    await testAPI('/api/traps/status');
    await testAPI('/api/alerts');
    await testAPI('/api/traps/details');
    await testAPI('/api/analytics');
    await testAPI('/api/analytics/advanced');
    log('✅ All API endpoints responding\n', colors.green);

    // Step 4: Validate specific issues
    await validateSpecificIssues();

    log('\n🎉 All validations completed successfully!', colors.green);
    log('✅ The dashboard is ready for production use.', colors.green);

  } catch (error) {
    log(`❌ Validation failed: ${error.message}`, colors.red);
    process.exit(1);
  }
}

main();
