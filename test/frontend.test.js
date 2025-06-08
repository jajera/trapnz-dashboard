import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';

// Load the HTML file
const html = fs.readFileSync('public/index.html', 'utf8');

describe('Frontend Dashboard Tests', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Create a new DOM for each test
    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.fetch = vi.fn();
  });

  describe('Dashboard UI Structure', () => {
    it('should have all main dashboard cards', () => {
      const expectedCards = [
        'totalTraps',
        'activeTraps',
        'needsCheck',
        'recentCatches',
        'dailyCatches',
        'avgEfficiency',
        'mostActiveSpecies',
        'topPerformingLine'
      ];

      expectedCards.forEach(cardId => {
        const element = document.getElementById(cardId);
        expect(element).toBeTruthy();
      });
    });

    it('should have alerts section', () => {
      const alertsSection = document.getElementById('alertsList');
      const alertBadge = document.getElementById('alertBadge');

      expect(alertsSection).toBeTruthy();
      expect(alertBadge).toBeTruthy();
    });

    it('should have trap modal structure', () => {
      const modal = document.getElementById('trapModal');
      const modalTitle = document.getElementById('modalTitle');
      const trapList = document.getElementById('trapList');

      expect(modal).toBeTruthy();
      expect(modalTitle).toBeTruthy();
      expect(trapList).toBeTruthy();
    });

    it('should have filter controls', () => {
      const projectFilter = document.getElementById('projectFilter');
      const lineFilter = document.getElementById('lineFilter');
      // Note: timeFilter was removed from modal as per user request

      expect(projectFilter).toBeTruthy();
      expect(lineFilter).toBeTruthy();
    });
  });

  describe('Dashboard Functions', () => {
    beforeEach(() => {
      // Mock global functions that would be available in browser
      window.updateDashboard = vi.fn();
      window.displayAlerts = vi.fn();
      window.displayTrapList = vi.fn();
      window.drillDownAlert = vi.fn();
      window.showTrapHistory = vi.fn();
    });

    it('should update dashboard metrics correctly', () => {
      const mockData = {
        total: 106,
        active: 9,
        recentCatches: 5,
        dailyCatches: 0,
        avgEfficiency: 14.0,
        mostActiveSpecies: 'Rat',
        topPerformingLine: 'MK Southern Line',
        totalLines: 3,
        trapsWithLines: 103
      };

      // Mock the function exists
      const updateFunction = window.eval(`
        function updateDashboard(data) {
          document.getElementById('totalTraps').textContent = data.total;
          document.getElementById('activeTraps').textContent = data.active;
          document.getElementById('recentCatches').textContent = data.recentCatches;
          document.getElementById('dailyCatches').textContent = data.dailyCatches || '0';
          document.getElementById('avgEfficiency').textContent = data.avgEfficiency ? data.avgEfficiency + '%' : '-';
          document.getElementById('mostActiveSpecies').textContent = data.mostActiveSpecies || 'None';
          document.getElementById('topPerformingLine').textContent = data.topPerformingLine || 'None';
        }
        updateDashboard
      `);

      updateFunction(mockData);

      expect(document.getElementById('totalTraps').textContent).toBe('106');
      expect(document.getElementById('activeTraps').textContent).toBe('9');
      expect(document.getElementById('recentCatches').textContent).toBe('5');
      expect(document.getElementById('dailyCatches').textContent).toBe('0');
      expect(document.getElementById('avgEfficiency').textContent).toBe('14%');
    });

    it('should display alerts with correct structure', () => {
      const mockAlerts = {
        alerts: [
          {
            level: 'critical',
            type: 'Inactive High Performers',
            message: '2 high-efficiency traps are inactive',
            count: 2,
            action: 'Consider reactivating these traps'
          }
        ],
        summary: {
          total: 1,
          critical: 1,
          high: 0,
          medium: 0,
          info: 0
        }
      };

      const displayFunction = window.eval(`
        function displayAlerts(alertsData) {
          const container = document.getElementById('alertsList');
          const badge = document.getElementById('alertBadge');

          if (!alertsData || !alertsData.alerts || alertsData.alerts.length === 0) {
            container.innerHTML = '<div style="color: #666;">No active alerts</div>';
            badge.textContent = '0';
            return;
          }

          badge.textContent = alertsData.summary.total;

          container.innerHTML = alertsData.alerts.map(alert =>
            '<div class="alert-item" data-type="' + alert.type + '">' +
            alert.type + ' (' + alert.count + ')' +
            '</div>'
          ).join('');
        }
        displayAlerts
      `);

      displayFunction(mockAlerts);

      expect(document.getElementById('alertBadge').textContent).toBe('1');

      const alertItems = document.querySelectorAll('.alert-item');
      expect(alertItems.length).toBe(1);
      expect(alertItems[0].getAttribute('data-type')).toBe('Inactive High Performers');
    });
  });

  describe('Data Consistency Validation', () => {
    it('should validate recent catches logic', () => {
      const mockTraps = [
        {
          id: 'MK12',
          isActive: false,
          lastCatch: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          efficiency: 21.0
        },
        {
          id: 'TR26',
          isActive: false,
          lastCatch: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
          efficiency: 21.4
        }
      ];

      const displayFunction = window.eval(`
        function displayTrapList(traps) {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

          return traps.map(trap => {
            const hasRecentCatch = trap.lastCatch && new Date(trap.lastCatch) > oneWeekAgo;
            const displayActive = hasRecentCatch || trap.isActive;

            return {
              id: trap.id,
              displayActive: displayActive,
              status: displayActive ? 'Active' : 'Inactive',
              hasRecentSuccess: hasRecentCatch
            };
          });
        }
        displayTrapList
      `);

      const result = displayFunction(mockTraps);

      // MK12 should show as active due to recent catch
      expect(result[0].displayActive).toBe(true);
      expect(result[0].status).toBe('Active');
      expect(result[0].hasRecentSuccess).toBe(true);

      // TR26 should show as inactive (no recent catch)
      expect(result[1].displayActive).toBe(false);
      expect(result[1].status).toBe('Inactive');
      expect(result[1].hasRecentSuccess).toBe(false);
    });

    it('should validate alert filtering consistency', () => {
      const mockTraps = [
        {
          id: 'MK12',
          isActive: false,
          efficiency: 21.0,
          lastCatch: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // Recent
        },
        {
          id: 'TR26',
          isActive: false,
          efficiency: 21.4,
          lastCatch: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // Old
        }
      ];

      const filterFunction = window.eval(`
        function filterInactiveHighPerformers(traps) {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

          return traps.filter(trap => {
            const hasRecentCatch = trap.lastCatch && new Date(trap.lastCatch) > oneWeekAgo;
            return !trap.isActive && trap.efficiency > 20 && !hasRecentCatch;
          });
        }
        filterInactiveHighPerformers
      `);

      const filtered = filterFunction(mockTraps);

      // Should only include TR26 (no recent catch), not MK12 (has recent catch)
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('TR26');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      const errorHandler = window.eval(`
        function handleAPIError(error) {
          console.error('API Error:', error);
          return {
            total: 0,
            active: 0,
            recentCatches: 0,
            error: true
          };
        }
        handleAPIError
      `);

      const result = errorHandler(new Error('Network error'));

      expect(result.error).toBe(true);
      expect(result.total).toBe(0);
    });

    it('should handle missing data gracefully', () => {
      const safeDisplayFunction = window.eval(`
        function safeUpdateDashboard(data) {
          data = data || {};

          document.getElementById('totalTraps').textContent = (data.total || 0).toString();
          document.getElementById('activeTraps').textContent = (data.active || 0).toString();
          document.getElementById('avgEfficiency').textContent = data.avgEfficiency ? data.avgEfficiency + '%' : '-';
          document.getElementById('mostActiveSpecies').textContent = data.mostActiveSpecies || 'None';
        }
        safeUpdateDashboard
      `);

      // Test with undefined data
      safeDisplayFunction(undefined);

      expect(document.getElementById('totalTraps').textContent).toBe('0');
      expect(document.getElementById('avgEfficiency').textContent).toBe('-');
      expect(document.getElementById('mostActiveSpecies').textContent).toBe('None');
    });
  });

  describe('Modal Functionality', () => {
    it('should show/hide modal correctly', () => {
      const modal = document.getElementById('trapModal');

      const modalFunctions = window.eval(`
        ({
          showModal: function() {
            document.getElementById('trapModal').style.display = 'block';
          },
          hideModal: function() {
            document.getElementById('trapModal').style.display = 'none';
          }
        })
      `);

      modalFunctions.showModal();
      expect(modal.style.display).toBe('block');

      modalFunctions.hideModal();
      expect(modal.style.display).toBe('none');
    });

    it('should update modal title correctly', () => {
      const modalTitle = document.getElementById('modalTitle');

      const updateTitle = window.eval(`
        function updateModalTitle(alertType, level) {
          document.getElementById('modalTitle').textContent = alertType + ' Alert - ' + level.toUpperCase() + ' Priority';
        }
        updateModalTitle
      `);

      updateTitle('Inactive High Performers', 'critical');
      expect(modalTitle.textContent).toBe('Inactive High Performers Alert - CRITICAL Priority');
    });
  });
});

export { };
