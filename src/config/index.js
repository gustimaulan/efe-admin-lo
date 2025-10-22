const dotenv = require('dotenv');
dotenv.config();

const development = require('./environments/development');
const staging = require('./environments/staging');
const production = require('./environments/production');

// Determine the active environment
const activeEnv = (() => {
    if (process.env.NODE_ENV === 'staging') {
        return 'staging';
    }
    // Default to 'regular' for 'production' or any other value
    return 'regular';
})();

// Environment configurations
const environments = {
    development,
    staging: staging,
    regular: production // 'regular' maps to production config
};

// Get active environment configuration
const activeConfig = environments[activeEnv] || production;

// Main configuration object
const config = {
    // Environment settings
    env: process.env.NODE_ENV || 'development',
    activeEnv: activeEnv,
    
    // Common settings
    ALLOWED_ADMIN_NAMES: ["admin 1", "admin 2", "admin 3", "admin 4", "admin 5", "admin 6", "admin 7", "admin 8", "admin 09", "admin 10", "admin 91", "admin 92", "admin 914", "admin 915", "admin 916", "admin 917", "admin 918"],
    LOGIN_URL: 'https://app.loops.id/login',
    CAMPAIGN_BASE_URL: 'https://app.loops.id/campaign/',
    
    // Server settings
    SERVER: {
        PORT: process.env.PORT || 3010,
        TIMEOUT: 600000 // 10 minutes
    },
    
    // Browser settings
    BROWSER: {
        ARGS: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    },
    
    // Job settings
    JOB: {
        CLEANUP_TIMEOUT: 3600000 // 1 hour
    },
    
    // User-defined rules (can be updated at runtime)
    USER_RULES: [],
    
    // Environment-specific configurations
    CAMPAIGN_IDS: activeConfig.CAMPAIGN_IDS,
    SPECIAL_CAMPAIGN: activeConfig.SPECIAL_CAMPAIGN,
    RULES: activeConfig.RULES,
    
    // Rule evaluation methods
    evaluateDefaultRules: function(adminName, campaignId, allSelectedAdmins = [], exemptionSettings = {}) {
        const rulesToEvaluate = this.RULES;

        if (!Array.isArray(rulesToEvaluate)) {
            return true;
        }

        const applicableRules = (rulesToEvaluate || [])
            .filter(rule => this.checkCondition(rule.condition, adminName, campaignId, allSelectedAdmins, exemptionSettings))
            .sort((a, b) => b.priority - a.priority);

        for (const rule of applicableRules) {
            if (rule.action.type === "ALLOW_BYPASS") {
                return true;
            }
            if (rule.action.type === "DENY") {
                return false;
            }
        }
        return true;
    },

    checkCondition: function(condition, adminName, campaignId, allSelectedAdmins, exemptionSettings) {
        switch (condition.type) {
            case "AND":
                return condition.conditions.every(sub => this.checkCondition(sub, adminName, campaignId, allSelectedAdmins, exemptionSettings));
            case "OR":
                return condition.conditions.some(sub => this.checkCondition(sub, adminName, campaignId, allSelectedAdmins, exemptionSettings));
            case "ADMIN":
                return this.checkAdminCondition(condition, adminName);
            case "CAMPAIGN":
                return this.checkCampaignCondition(condition, campaignId);
            case "ALL_SELECTED_ADMINS_CONTAINS":
                return this.checkAllSelectedAdminsContainsCondition(condition, allSelectedAdmins);
            case "ADMIN_IS_EXEMPT":
                return exemptionSettings.exemptAdmin === adminName;
            default:
                return false;
        }
    },

    checkAdminCondition: function(condition, adminName) {
        const op = condition.operator || "==";
        if (op === "!=") {
            return adminName !== condition.value;
        } else if (op === "IN") {
            return Array.isArray(condition.value) && condition.value.includes(adminName);
        }
        return adminName === condition.value;
    },

    checkCampaignCondition: function(condition, campaignId) {
        const op = condition.operator || "==";
        if (op === "!=") {
            return parseInt(campaignId) !== parseInt(condition.value);
        }
        return parseInt(campaignId) === parseInt(condition.value);
    },

    checkAllSelectedAdminsContainsCondition: function(condition, allSelectedAdmins) {
        if (Array.isArray(condition.value)) {
            return condition.value.every(admin => allSelectedAdmins.includes(admin));
        }
        return allSelectedAdmins.includes(String(condition.value));
    },
    
    // Process admin rules based on the new payload structure
    processAdminRules: function(adminPayload, campaignId) {
        const { name, ruleType, campaignId: targetCampaignId } = adminPayload;
        
        if (ruleType === null && targetCampaignId === null) {
            return true;
        }
        
        if (ruleType === 'include') {
            return parseInt(targetCampaignId) === parseInt(campaignId);
        } else if (ruleType === 'exclude') {
            return parseInt(targetCampaignId) !== parseInt(campaignId);
        }
        
        return true;
    },
    
    // Check if an admin can process a campaign with the new payload structure
    canAdminProcessCampaign: function(adminName, campaignId, allSelectedAdmins, exemptionSettings = {}) {
        // Step 1: Check user-defined rules first.
        const userRule = (this.USER_RULES || []).find(r => r.admin === adminName);
        if (userRule) {
            const userRuleResult = this.processAdminRules(userRule, campaignId);
            if (!userRuleResult) {
                return false;
            }
        }

        // Step 2: If no user rule denies access, check against the default complex rules.
        const defaultRuleResult = this.evaluateDefaultRules(adminName, campaignId, allSelectedAdmins, exemptionSettings);
        
        return defaultRuleResult;
    },
    
    // Get filtered admins for a specific campaign based on the new payload structure
    getAdminsForCampaign: function(adminPayloads, campaignId, exemptionSettings = {}) {
        const allSelectedAdmins = adminPayloads.map(p => p.name);
        return adminPayloads
            .filter(payload => this.canAdminProcessCampaign(payload.name, campaignId, allSelectedAdmins, exemptionSettings))
            .map(payload => payload.name);
    }
};

module.exports = config;