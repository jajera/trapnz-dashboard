import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';

// Mock environment
process.env.TRAPNZ_WFS_TOKEN = 'test-token';

describe('TrapNZ Dashboard API Tests', () => {
  let server;

  beforeAll(() => {
    server = app.listen(0); // Use random port for testing
  });

  afterAll(() => {
    server.close();
  });

  describe('Basic API Endpoints', () => {
    it('should get projects list', async () => {
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Validate project structure
      const project = response.body[0];
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('region');
    });

    it('should get trap status overview', async () => {
      const response = await request(app).get('/api/traps/status?months=999');
      expect(response.status).toBe(200);

      const metrics = response.body;
      expect(metrics).toHaveProperty('total');
      expect(metrics).toHaveProperty('active');
      expect(metrics).toHaveProperty('recentCatches');
      expect(metrics).toHaveProperty('avgEfficiency');
      expect(metrics).toHaveProperty('totalLines');
      expect(metrics).toHaveProperty('trapsWithLines');

      // Validate metric types
      expect(typeof metrics.total).toBe('number');
      expect(typeof metrics.active).toBe('number');
      expect(typeof metrics.avgEfficiency).toBe('number');
    });

    it('should get trap details with filtering', async () => {
      const response = await request(app).get('/api/traps/details?limit=10');
      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('traps');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('showing');
      expect(response.body).toHaveProperty('filters');

      expect(Array.isArray(response.body.traps)).toBe(true);
    });
  });

  describe('Alert System Tests', () => {
    it('should get alerts with proper structure', async () => {
      const response = await request(app).get('/api/alerts?months=999');
      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('alerts');
      expect(response.body).toHaveProperty('summary');

      const summary = response.body.summary;
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('critical');
      expect(summary).toHaveProperty('high');
      expect(summary).toHaveProperty('medium');
      expect(summary).toHaveProperty('info');

      // Validate alert structure if any exist
      if (response.body.alerts.length > 0) {
        const alert = response.body.alerts[0];
        expect(alert).toHaveProperty('level');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('count');
        expect(alert).toHaveProperty('action');
      }
    });

    it('should have consistent alert counts between API and drilldown', async () => {
      const alertsResponse = await request(app).get('/api/alerts?months=999');
      const alerts = alertsResponse.body.alerts;

      for (const alert of alerts) {
        // Test drilldown data matches alert count
        let filterParams = 'months=999&limit=200';

        switch (alert.type) {
          case 'Inactive High Performers':
            filterParams += '&statusFilter=all';
            break;
          case 'Overdue Maintenance':
            filterParams += '&statusFilter=all';
            break;
          default:
            filterParams += '&statusFilter=all';
        }

        const drilldownResponse = await request(app)
          .get(`/api/traps/details?${filterParams}`);

        expect(drilldownResponse.status).toBe(200);

        // Apply same filtering logic as frontend
        let filteredCount = 0;
        const now = new Date();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        switch (alert.type) {
          case 'Inactive High Performers':
            filteredCount = drilldownResponse.body.traps.filter(trap => {
              const hasRecentCatch = trap.lastCatch && new Date(trap.lastCatch) > oneWeekAgo;
              return !trap.isActive && trap.efficiency > 20 && !hasRecentCatch;
            }).length;
            break;
          case 'Overdue Maintenance':
            filteredCount = drilldownResponse.body.traps.filter(trap => {
              if (!trap.lastUpdate) return false;
              const daysSince = (now - new Date(trap.lastUpdate)) / (1000 * 60 * 60 * 24);
              return daysSince > 14;
            }).length;
            break;
        }

        expect(filteredCount).toBe(alert.count);
      }
    });
  });

  describe('Advanced Analytics Tests', () => {
    it('should get analytics data', async () => {
      const response = await request(app).get('/api/analytics?months=999');
      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('trends');
      expect(response.body).toHaveProperty('lineStats');
    });

    it('should get advanced analytics charts', async () => {
      const response = await request(app).get('/api/analytics/advanced');
      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('dailyTrends');
      expect(response.body).toHaveProperty('linePerformance');
      expect(response.body).toHaveProperty('weeklyPatterns');
      expect(response.body).toHaveProperty('speciesDistribution');
    });

    it('should get anomalies', async () => {
      const response = await request(app).get('/api/analytics/anomalies');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get maintenance predictions', async () => {
      const response = await request(app).get('/api/analytics/maintenance');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('schedule');
      expect(response.body).toHaveProperty('healthScores');
      expect(Array.isArray(response.body.schedule)).toBe(true);
      expect(Array.isArray(response.body.healthScores)).toBe(true);
    });

    it('should get AI insights', async () => {
      const response = await request(app).get('/api/analytics/insights');
      expect(response.status).toBe(200);
      expect(typeof response.body).toBe('object');
      // Insights returns an object with different insight types, not an array
    });
  });

  describe('Data Consistency Tests', () => {
    it('should have consistent recent catches across endpoints', async () => {
      const statusResponse = await request(app).get('/api/traps/status?months=999');
      const recentCatchesFromStatus = statusResponse.body.recentCatches;

      // Get recent catches through details API
      const detailsResponse = await request(app).get('/api/traps/details?months=1');
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const recentCatchesFromDetails = detailsResponse.body.traps.filter(trap => {
        if (!trap.lastCatch) return false;
        return new Date(trap.lastCatch) > oneWeekAgo;
      }).length;

      expect(recentCatchesFromStatus).toBe(recentCatchesFromDetails);
    });

    it('should have consistent active trap counts', async () => {
      const statusResponse = await request(app).get('/api/traps/status?months=999');
      const activeFromStatus = statusResponse.body.active;

      const detailsResponse = await request(app).get('/api/traps/details?months=999&limit=500');
      const activeFromDetails = detailsResponse.body.traps.filter(trap => {
        // Apply same logic as displayTrapList for recent catches override
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const hasRecentCatch = trap.lastCatch && new Date(trap.lastCatch) > oneWeekAgo;

        return hasRecentCatch || trap.isActive;
      }).length;

      expect(activeFromStatus).toBe(activeFromDetails);
    });

    it('should have valid line assignments', async () => {
      const detailsResponse = await request(app).get('/api/traps/details?months=999&limit=500');
      const traps = detailsResponse.body.traps;

      let trapsWithLines = 0;
      const uniqueLines = new Set();

      traps.forEach(trap => {
        if (trap.lineId && trap.lineName) {
          trapsWithLines++;
          uniqueLines.add(trap.lineId);
        }
      });

      const statusResponse = await request(app).get('/api/traps/status?months=999');
      expect(statusResponse.body.trapsWithLines).toBe(trapsWithLines);
      expect(statusResponse.body.totalLines).toBe(uniqueLines.size);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle invalid project ID', async () => {
      const response = await request(app).get('/api/projects/999999/metrics');
      expect(response.status).toBe(404); // Should return not found for invalid project ID
    });

    it('should handle invalid filter parameters', async () => {
      const response = await request(app).get('/api/traps/details?months=invalid');
      expect(response.status).toBe(200); // Should default gracefully
    });

    it('should handle missing trap ID', async () => {
      const response = await request(app).get('/api/traps//history');
      expect(response.status).toBe(404);
    });
  });

  describe('Performance Tests', () => {
    it('should respond to status within reasonable time', async () => {
      const startTime = Date.now();
      const response = await request(app).get('/api/traps/status?months=999');
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should handle large data requests', async () => {
      const response = await request(app).get('/api/traps/details?limit=500&months=999');
      expect(response.status).toBe(200);
      expect(response.body.showing).toBeLessThanOrEqual(500);
    });
  });
});

// Export for use in other test files
export { app };
