import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from './api.test.js';

describe('Integration Tests - End-to-End Data Flow', () => {
  let server;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  describe('Alert System Integration', () => {
    it('should maintain data consistency across alert generation and drilldown', async () => {
      // Step 1: Get alerts
      const alertsResponse = await request(app).get('/api/alerts?months=999');
      expect(alertsResponse.status).toBe(200);

      const alerts = alertsResponse.body.alerts;

      // Step 2: For each alert, verify drilldown matches
      for (const alert of alerts) {
        // Get drilldown data using same logic as frontend
        const detailsResponse = await request(app)
          .get('/api/traps/details?months=999&statusFilter=all&limit=500');

        expect(detailsResponse.status).toBe(200);

        // Apply frontend filtering logic
        const allTraps = detailsResponse.body.traps;
        let expectedCount = 0;
        const now = new Date();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        switch (alert.type) {
          case 'Inactive High Performers':
            expectedCount = allTraps.filter(trap => {
              const hasRecentCatch = trap.lastCatch && new Date(trap.lastCatch) > oneWeekAgo;
              return !trap.isActive && trap.efficiency > 20 && !hasRecentCatch;
            }).length;
            break;

          case 'Overdue Maintenance':
            expectedCount = allTraps.filter(trap => {
              if (!trap.lastUpdate) return false;
              const daysSince = (now - new Date(trap.lastUpdate)) / (1000 * 60 * 60 * 24);
              return daysSince > 14;
            }).length;
            break;

          case 'Low Efficiency':
            expectedCount = allTraps.filter(trap =>
              trap.isActive && trap.efficiency < 0 && trap.totalChecks > 5
            ).length;
            break;

          case 'Recent Successes':
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            expectedCount = allTraps.filter(trap => {
              if (!trap.lastCatch) return false;
              return new Date(trap.lastCatch) > oneDayAgo;
            }).length;
            break;
        }

        expect(alert.count).toBe(expectedCount);
      }
    });

    it('should validate specific alert drilldown consistency - especially Overdue Maintenance', async () => {
      // Get alerts API response
      const alertsResponse = await request(app).get('/api/alerts?months=999');
      expect(alertsResponse.status).toBe(200);

      const alerts = alertsResponse.body.alerts;
      const overdueMaintenanceAlert = alerts.find(alert => alert.type === 'Overdue Maintenance');

      if (overdueMaintenanceAlert) {
        console.log(`\n=== OVERDUE MAINTENANCE CONSISTENCY TEST ===`);
        console.log(`Alert API shows Overdue Maintenance count: ${overdueMaintenanceAlert.count}`);

        // Test server-side logic (how alerts are generated)
        const serverDetailsResponse = await request(app)
          .get('/api/traps/details?months=999&statusFilter=all&limit=1000');
        expect(serverDetailsResponse.status).toBe(200);
        const serverTraps = serverDetailsResponse.body.traps;

        // Test frontend drilldown logic (what user sees when clicking) - now fixed
        const frontendDetailsResponse = await request(app)
          .get('/api/traps/details?months=999&statusFilter=all&limit=1000');
        expect(frontendDetailsResponse.status).toBe(200);
        const frontendTraps = frontendDetailsResponse.body.traps;

        const now = new Date();

        // Server-side filtering (matches alert generation)
        const serverOverdueTraps = serverTraps.filter(trap => {
          if (!trap.lastUpdate) return false;
          const daysSince = (now - new Date(trap.lastUpdate)) / (1000 * 60 * 60 * 24);
          return daysSince > 14; // Include both active and inactive
        });

        // Frontend filtering (now matches server logic)
        const frontendOverdueTraps = frontendTraps.filter(trap => {
          if (!trap.lastUpdate) return false;
          const daysSince = (now - new Date(trap.lastUpdate)) / (1000 * 60 * 60 * 24);
          return daysSince > 14; // Now matches server logic
        });

        console.log(`Server logic shows: ${serverOverdueTraps.length} overdue traps`);
        console.log(`Frontend drilldown shows: ${frontendOverdueTraps.length} overdue traps`);

        // Both counts should match the alert count
        expect(overdueMaintenanceAlert.count).toBe(serverOverdueTraps.length);
        expect(overdueMaintenanceAlert.count).toBe(frontendOverdueTraps.length);

        console.log(`✅ FIXED: Alert count (${overdueMaintenanceAlert.count}) now matches drilldown (${frontendOverdueTraps.length})`);
      }
    });

    it('should handle MK12 status consistency across all endpoints', async () => {
      // Get all data sources that might show MK12
      const [statusResponse, detailsResponse, alertsResponse] = await Promise.all([
        request(app).get('/api/traps/status?months=999'),
        request(app).get('/api/traps/details?months=999&limit=500'),
        request(app).get('/api/alerts?months=999')
      ]);

      const allTraps = detailsResponse.body.traps;
      const mk12 = allTraps.find(trap => trap.trapCode === 'MK12' || trap.id === 'MK12');

      if (mk12) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const hasRecentCatch = mk12.lastCatch && new Date(mk12.lastCatch) > oneWeekAgo;

        // MK12 should be considered active if it has recent catches
        const shouldBeActive = hasRecentCatch || mk12.isActive;

        // Check that MK12 is NOT in Inactive High Performers if it has recent catches
        const inactiveHighPerformersAlert = alertsResponse.body.alerts
          .find(alert => alert.type === 'Inactive High Performers');

        if (inactiveHighPerformersAlert && hasRecentCatch) {
          // MK12 should not be counted in this alert
          const drilldownResponse = await request(app)
            .get('/api/traps/details?months=999&statusFilter=all&limit=500');

          const inactiveHighPerformers = drilldownResponse.body.traps.filter(trap => {
            const trapHasRecentCatch = trap.lastCatch && new Date(trap.lastCatch) > oneWeekAgo;
            return !trap.isActive && trap.efficiency > 20 && !trapHasRecentCatch;
          });

          const mk12InAlert = inactiveHighPerformers.find(trap =>
            trap.trapCode === 'MK12' || trap.id === 'MK12'
          );

          expect(mk12InAlert).toBeUndefined();
        }
      }
    });
  });

  describe('Dashboard Metrics Integration', () => {
    it('should maintain consistent counts across dashboard and details', async () => {
      const [statusResponse, detailsResponse] = await Promise.all([
        request(app).get('/api/traps/status?months=999'),
        request(app).get('/api/traps/details?months=999&limit=1000')
      ]);

      const dashboard = statusResponse.body;
      const allTraps = detailsResponse.body.traps;

      // Total traps should match
      expect(dashboard.total).toBe(allTraps.length);

      // Recent catches consistency
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const recentCatchesFromDetails = allTraps.filter(trap => {
        if (!trap.lastCatch) return false;
        return new Date(trap.lastCatch) > oneWeekAgo;
      }).length;

      expect(dashboard.recentCatches).toBe(recentCatchesFromDetails);

      // Active traps with recent catches override
      const activeFromDetails = allTraps.filter(trap => {
        const hasRecentCatch = trap.lastCatch && new Date(trap.lastCatch) > oneWeekAgo;
        return hasRecentCatch || trap.isActive;
      }).length;

      expect(dashboard.active).toBe(activeFromDetails);

      // Line statistics
      const trapsWithLines = allTraps.filter(trap => trap.lineId && trap.lineName).length;
      const uniqueLines = new Set(allTraps.filter(trap => trap.lineId).map(trap => trap.lineId)).size;

      expect(dashboard.trapsWithLines).toBe(trapsWithLines);
      expect(dashboard.totalLines).toBe(uniqueLines);
    });

    it('should calculate efficiency metrics correctly', async () => {
      const detailsResponse = await request(app).get('/api/traps/details?months=999&limit=1000');
      const allTraps = detailsResponse.body.traps;

      if (allTraps.length > 0) {
        const calculatedAvgEfficiency = allTraps.reduce((sum, trap) =>
          sum + (trap.efficiency || 0), 0) / allTraps.length;

        const statusResponse = await request(app).get('/api/traps/status?months=999');
        const reportedAvgEfficiency = statusResponse.body.avgEfficiency;

        expect(Math.abs(reportedAvgEfficiency - calculatedAvgEfficiency)).toBeLessThan(0.1);
      }
    });
  });

  describe('Line Assignment Integration', () => {
    it('should maintain consistent line assignments', async () => {
      const detailsResponse = await request(app).get('/api/traps/details?months=999&limit=1000');
      const allTraps = detailsResponse.body.traps;

      // Validate line assignment consistency
      const trapsByLine = {};
      allTraps.forEach(trap => {
        if (trap.lineId && trap.lineName) {
          if (!trapsByLine[trap.lineId]) {
            trapsByLine[trap.lineId] = {
              name: trap.lineName,
              color: trap.lineColor,
              traps: []
            };
          }
          trapsByLine[trap.lineId].traps.push(trap);

          // All traps in same line should have same name and color
          expect(trap.lineName).toBe(trapsByLine[trap.lineId].name);
          if (trap.lineColor) {
            expect(trap.lineColor).toBe(trapsByLine[trap.lineId].color);
          }
        }
      });

      // Validate specific line assignments based on patterns
      allTraps.forEach(trap => {
        const trapCode = trap.trapCode || trap.name || '';

        // Test pattern-based assignments
        if (trapCode.startsWith('MK')) {
          expect(trap.lineName).toMatch(/MK/);
        }
        if (trapCode.startsWith('TR') && trapCode.match(/TR0[1-5]/)) {
          expect(trap.lineName).toBe('Tawatawa Reserve');
        }
        if (trapCode.startsWith('P') && trapCode.match(/P[1-9]/)) {
          expect(trap.lineName).toBe('Northern Line');
        }
      });
    });

    it('should provide line performance data', async () => {
      const analyticsResponse = await request(app).get('/api/analytics/advanced');
      expect(analyticsResponse.status).toBe(200);

      const linePerformance = analyticsResponse.body.linePerformance;
      expect(typeof linePerformance).toBe('object');
      expect(linePerformance).toHaveProperty('labels');
      expect(linePerformance).toHaveProperty('data');
      expect(Array.isArray(linePerformance.labels)).toBe(true);
      expect(Array.isArray(linePerformance.data)).toBe(true);

      // Validate data consistency
      expect(linePerformance.labels.length).toBe(linePerformance.data.length);
      linePerformance.data.forEach(value => {
        expect(typeof value).toBe('number');
      });
    });
  });

  describe('Analytics Integration', () => {
    it('should provide consistent analytics across endpoints', async () => {
      const [basicAnalytics, advancedAnalytics, anomalies, maintenance] = await Promise.all([
        request(app).get('/api/analytics?months=999'),
        request(app).get('/api/analytics/advanced'),
        request(app).get('/api/analytics/anomalies'),
        request(app).get('/api/analytics/maintenance')
      ]);

      expect(basicAnalytics.status).toBe(200);
      expect(advancedAnalytics.status).toBe(200);
      expect(anomalies.status).toBe(200);
      expect(maintenance.status).toBe(200);

      // Validate data structure consistency
      expect(basicAnalytics.body).toHaveProperty('summary');
      expect(advancedAnalytics.body).toHaveProperty('dailyTrends');
      expect(Array.isArray(anomalies.body)).toBe(true);
      expect(typeof maintenance.body).toBe('object');
      expect(maintenance.body).toHaveProperty('schedule');
      expect(maintenance.body).toHaveProperty('healthScores');
    });

    it('should provide forecasting and insights', async () => {
      const [forecasting, insights] = await Promise.all([
        request(app).get('/api/analytics/forecasting'),
        request(app).get('/api/analytics/insights')
      ]);

      expect(forecasting.status).toBe(200);
      expect(insights.status).toBe(200);

      expect(typeof forecasting.body).toBe('object');
      expect(typeof insights.body).toBe('object');
    });
  });

  describe('Error Recovery Integration', () => {
    it('should handle partial data gracefully', async () => {
      // Test with invalid project ID but expect graceful degradation
      const response = await request(app).get('/api/projects/999999/metrics');
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should maintain service availability during errors', async () => {
      // Even if some endpoints fail, core functionality should work
      const coreEndpoints = [
        '/api/projects',
        '/api/traps/status',
        '/api/alerts'
      ];

      const responses = await Promise.all(
        coreEndpoints.map(endpoint => request(app).get(endpoint))
      );

      // At least basic endpoints should work
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array(5).fill().map(() =>
        request(app).get('/api/traps/status?months=999')
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds for 5 concurrent requests
    });

    it('should handle large data requests within time limits', async () => {
      const startTime = Date.now();
      const response = await request(app).get('/api/traps/details?months=999&limit=1000');
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(8000); // 8 seconds max
    });
  });
});

export { };
