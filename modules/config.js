// Configuration and utility functions

const CONFIG = {
    ROLLING_WINDOW: 5,           // window size for rolling averages
    MIN_GAMES_FOR_TREND: 3       // minimum sessions before we compute a trend
};

const OPPONENT_ALIASES = {
    michingan: 'michigan'
};

// Utility functions
const utils = {
    // Calculate average of array
    avg: (arr) => {
        const filtered = arr.filter(x => x !== null && !isNaN(x));
        return filtered.length ? filtered.reduce((a, b) => a + b, 0) / filtered.length : null;
    },

    // Calculate standard deviation
    stdDev: (arr) => {
        const filtered = arr.filter(x => x !== null && !isNaN(x));
        if (filtered.length === 0) return null;
        const mean = utils.avg(filtered);
        const squaredDiffs = filtered.map(x => Math.pow(x - mean, 2));
        return Math.sqrt(utils.avg(squaredDiffs));
    },

    // Simple linear regression to detect trend
    linearTrend: (values) => {
        const filtered = values.filter(x => x !== null && !isNaN(x));
        if (filtered.length < 2) return 0;
        
        const n = filtered.length;
        const indices = filtered.map((_, i) => i);
        const sumX = indices.reduce((a, b) => a + b, 0);
        const sumY = filtered.reduce((a, b) => a + b, 0);
        const sumXY = indices.reduce((sum, x, i) => sum + x * filtered[i], 0);
        const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    },

    // Format percentage
    pct: (val, decimals = 1) => {
        if (val === null || val === undefined || isNaN(val)) return '-';
        return (val * 100).toFixed(decimals) + '%';
    },

    // Format number
    num: (val, decimals = 2) => {
        if (val === null || val === undefined || isNaN(val)) return '-';
        return val.toFixed(decimals);
    },

    // Get trend direction
    getTrendDirection: (slope, threshold = 0.01) => {
        if (Math.abs(slope) < threshold) return 'stable';
        return slope > 0 ? 'up' : 'down';
    },

    // Safe stat extraction
    getStat: (stats, key) => {
        const val = stats[key];
        return (val !== null && val !== undefined && !isNaN(val)) ? val : null;
    },

    // Calculate rolling average
    rollingAvg: (values, window = CONFIG.ROLLING_WINDOW) => {
        const result = [];
        for (let i = 0; i < values.length; i++) {
            const start = Math.max(0, i - window + 1);
            const slice = values.slice(start, i + 1).filter(x => x !== null && !isNaN(x));
            result.push(slice.length ? utils.avg(slice) : null);
        }
        return result;
    },

    // Format date
    parseLocalDate: (dateStr) => {
        if (!dateStr) return null;
        const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return new Date(dateStr);
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    },

    formatDate: (dateStr) => {
        if (!dateStr) return '-';
        const date = utils.parseLocalDate(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    normalizeOpponentKey: (opponent) => {
        if (!opponent) return '';
        const key = String(opponent).trim().replace(/\s+/g, ' ').toLowerCase();
        return OPPONENT_ALIASES[key] || key;
    },

    formatOpponent: (opponent) => {
        if (!opponent) return null;
        const clean = String(opponent).trim().replace(/\s+/g, ' ');
        const canonical = OPPONENT_ALIASES[clean.toLowerCase()];
        if (canonical) {
            return canonical.replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w/g, c => c.toLowerCase());
        }
        if (clean === clean.toLowerCase() || clean === clean.toUpperCase()) {
            return clean.replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w/g, c => c.toLowerCase());
        }
        return clean;
    },

    // Get improvement percentage
    getImprovement: (oldVal, newVal) => {
        if (!oldVal || !newVal) return null;
        return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
    }
};

// Export for other modules
window.CONFIG = CONFIG;
window.utils = utils;
