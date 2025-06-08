import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Trap.NZ API Client
class TrapNZClient {
    constructor() {
        this.baseUrl = 'https://io.trap.nz/geo/trapnz-projects/wfs';
    }
    
    getToken() {
        if (!this.token) {
            this.token = process.env.TRAPNZ_WFS_TOKEN;
            if (!this.token) {
                throw new Error('TRAPNZ_WFS_TOKEN environment variable is not set');
            }
        }
        return this.token;
    }

    async getProjects() {
        try {
            const filePath = join(__dirname, '../../data/projects.json');
            const file = await readFile(filePath, 'utf-8');
            const data = JSON.parse(file);
            return data.projects;
        } catch (error) {
            console.error('Error loading projects:', error);
            throw error;
        }
    }

    async getTrapData(projectId, config = null) {
        const token = this.getToken();
        const url = `${this.baseUrl}/${token}/${projectId}?service=WFS&version=2.0.0&request=GetFeature&typeName=trapnz-projects:default-project-trap-records&outputFormat=application/json`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return this.processTrapData(data, projectId, config);
        } catch (error) {
            console.error(`Error fetching trap data for project ${projectId}:`, error);
            throw error;
        }
    }

    // Utility function to safely parse dates
    parseDate(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    }

    // Utility function to determine trap status
    determineTrapStatus(records) {
        // Get the most recent record
        const sortedRecords = records.sort((a, b) => {
            const dateA = this.parseDate(a.record_date) || new Date(0);
            const dateB = this.parseDate(b.record_date) || new Date(0);
            return dateB - dateA;
        });

        const latestRecord = sortedRecords[0];
        const status = latestRecord?.trap_status || latestRecord?.status || 'unknown';
        
        return {
            status: status.toLowerCase(),
            isActive: status.toLowerCase().includes('active') || status.toLowerCase().includes('set'),
            lastUpdate: this.parseDate(latestRecord?.record_date)
        };
    }

    // Utility function to calculate trap efficiency (strikes-based)
    calculateTrapEfficiency(records) {
        const totalChecks = records.length;
        // Count actual catches (strikes) - exclude "None" and empty values
        const catchRecords = records.filter(record => {
            const species = record.species_caught;
            return species && 
                   species.toLowerCase() !== 'none' && 
                   species.toLowerCase() !== 'null' &&
                   species.trim() !== '';
        });
        
        return {
            totalChecks,
            totalCatches: catchRecords.length,
            efficiency: totalChecks > 0 ? (catchRecords.length / totalChecks * 100) : 0,
            lastCatch: this.getLastCatchDate(catchRecords),
            speciesCaught: [...new Set(catchRecords.map(r => r.species_caught).filter(s => s && s.toLowerCase() !== 'none'))]
        };
    }

    // Utility function to get last catch date
    getLastCatchDate(catchRecords) {
        if (catchRecords.length === 0) return null;
        
        const dates = catchRecords
            .map(record => this.parseDate(record.record_date))
            .filter(Boolean)
            .sort((a, b) => b - a);
            
        return dates[0] || null;
    }

    // Utility function to analyze bait usage
    analyzeBaitUsage(records) {
        const baitTypes = records
            .map(record => record.bait_type || record.bait)
            .filter(Boolean);
            
        const baitCounts = {};
        baitTypes.forEach(bait => {
            baitCounts[bait] = (baitCounts[bait] || 0) + 1;
        });
        
        return {
            mostUsedBait: Object.keys(baitCounts).reduce((a, b) => 
                baitCounts[a] > baitCounts[b] ? a : b, null),
            baitTypes: Object.keys(baitCounts),
            baitHistory: baitCounts
        };
    }

    processTrapData(data, projectId, config = null) {
        if (!data.features || !Array.isArray(data.features)) {
            console.warn(`No features found in trap data for project ${projectId}`);
            return { uniqueTraps: [], rawRecords: [] };
        }

        // Group records by trap_id to get unique traps
        const trapGroups = {};
        
        data.features.forEach(feature => {
            const props = feature.properties || {};
            const trapId = props.trap_id || props.id;
            
            if (!trapId) return; // Skip records without trap_id
            
            if (!trapGroups[trapId]) {
                trapGroups[trapId] = {
                    trapId,
                    records: [],
                    geometry: feature.geometry
                };
            }
            
            // Store only essential fields to reduce memory usage
            trapGroups[trapId].records.push({
                record_date: props.record_date || props.date_last_checked,
                trap_status: props.trap_status || props.status,
                species_caught: props.species_caught || props.species,
                bait_type: props.bait_type || props.bait,
                outcome: props.outcome,
                notes: props.notes || props.comments,
                trap_condition: props.trap_condition,
                trap_code: props.trap_code || props.code,
                trap_type: props.trap_type || props.type,
                coordinates: feature.geometry?.coordinates
            });
        });

        // Process each unique trap
        const uniqueTraps = Object.values(trapGroups).map(trapGroup => {
            const { trapId, records, geometry } = trapGroup;
            const latestRecord = records[0]; // Assuming first record has basic info
            
            const statusInfo = this.determineTrapStatus(records);
            const efficiency = this.calculateTrapEfficiency(records);
            const baitAnalysis = this.analyzeBaitUsage(records);
            
            return {
                id: trapId,
                name: latestRecord?.trap_code || `Trap ${trapId}`,
                trapCode: latestRecord?.trap_code || trapId,
                trapType: latestRecord?.trap_type || 'Unknown',
                projectId,
                coordinates: geometry?.coordinates,
                
                // Status information
                status: statusInfo.status,
                isActive: statusInfo.isActive,
                lastUpdate: statusInfo.lastUpdate,
                
                // Performance metrics
                totalChecks: efficiency.totalChecks,
                totalCatches: efficiency.totalCatches,
                efficiency: efficiency.efficiency,
                lastCatch: efficiency.lastCatch,
                speciesCaught: efficiency.speciesCaught,
                
                // Bait information
                mostUsedBait: baitAnalysis.mostUsedBait,
                baitTypes: baitAnalysis.baitTypes,
                
                // Maintenance info  
                needsCheck: this.needsCheck(statusInfo.lastUpdate, efficiency.efficiency, config),
                condition: latestRecord?.trap_condition,
                
                // Raw records count for reference
                recordCount: records.length
            };
        });

        return {
            uniqueTraps,
            rawRecords: data.features.length,
            trapCount: uniqueTraps.length
        };
    }

    // Utility function to determine if trap needs checking (with configurable thresholds)
    needsCheck(lastUpdate, efficiency = 0, config = null) {
        if (!lastUpdate) return true;
        
        // Use config if available, otherwise defaults
        const daysThreshold = config?.needsAttention?.daysWithoutCheck || 7;
        const efficiencyThreshold = config?.needsAttention?.lowEfficiencyThreshold || 10;
        
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
        
        // Needs check if last update was too long ago OR efficiency is too low
        return lastUpdate < thresholdDate || efficiency < efficiencyThreshold;
    }

    // Reusable function to calculate time-based metrics
    calculateTimeBasedMetrics(traps, days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        return {
            recentActivity: traps.filter(trap => 
                trap.lastUpdate && trap.lastUpdate > cutoffDate
            ).length,
            recentCatches: traps.filter(trap => 
                trap.lastCatch && trap.lastCatch > cutoffDate
            ).length
        };
    }

    // Reusable function to get top performing traps
    getTopPerformingTraps(traps, limit = 10) {
        return traps
            .filter(trap => trap.totalChecks > 0)
            .sort((a, b) => b.efficiency - a.efficiency)
            .slice(0, limit)
            .map(trap => ({
                id: trap.id,
                name: trap.name,
                efficiency: trap.efficiency,
                totalCatches: trap.totalCatches,
                totalChecks: trap.totalChecks,
                speciesCaught: trap.speciesCaught,
                mostUsedBait: trap.mostUsedBait
            }));
    }
}

export default new TrapNZClient(); 