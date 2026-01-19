const fs = require('fs');
const path = require('path');
const loggerService = require('./loggerService');

class HistoryService {
    constructor() {
        this.historyDir = path.join(__dirname, '../../data');
        this.historyFile = path.join(this.historyDir, 'history.json');
        this.maxEntries = 10;

        this.ensureDirectoryExists();
    }

    ensureDirectoryExists() {
        if (!fs.existsSync(this.historyDir)) {
            fs.mkdirSync(this.historyDir, { recursive: true });
        }
    }

    /**
     * Get submission history
     * @param {number} limit - Number of entries to return
     * @returns {Array} - Array of history entries
     */
    getHistory(limit = 5) {
        try {
            if (!fs.existsSync(this.historyFile)) {
                return [];
            }

            const data = fs.readFileSync(this.historyFile, 'utf8');
            const history = JSON.parse(data);

            return history.slice(0, limit);
        } catch (error) {
            loggerService.error('Error reading history file:', error);
            return [];
        }
    }

    /**
     * Add a new history entry
     * @param {Object} entry - Entry data (admins, timeOfDay, browserType, timestamp)
     */
    addEntry(entry) {
        try {
            let history = [];

            if (fs.existsSync(this.historyFile)) {
                const data = fs.readFileSync(this.historyFile, 'utf8');
                history = JSON.parse(data);
            }

            // Ensure we have a timestamp if not provided
            if (!entry.timestamp) {
                entry.timestamp = new Date().toISOString();
            }

            // Add new entry to the beginning
            history.unshift(entry);

            // Limit history size
            if (history.length > this.maxEntries) {
                history = history.slice(0, this.maxEntries);
            }

            fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
            loggerService.info('History entry added:', entry);
        } catch (error) {
            loggerService.error('Error writing to history file:', error);
        }
    }
}

module.exports = new HistoryService();
