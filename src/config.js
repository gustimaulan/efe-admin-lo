
const dotenv = require('dotenv');
dotenv.config();

// Enhanced configuration with new payload-based rule system
const config = {
    // Determine the active environment. Default to 'regular' if NODE_ENV is not 'staging'.
    activeEnv: (() => {
        if (process.env.NODE_ENV === 'staging') {
            return 'staging';
        }
        // Default to 'regular' for 'production' or any other value.
        // 'regular' is considered the production environment.
        return 'regular';
    })(),

    // All possible configurations are stored here
    _campaignIds: {
        regular: {
            pagi: [247001, 288437, 281482, 250794, 250554, 250433, 250432, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            siang: [247001, 288437, 281482, 250794, 250554, 250433, 250432, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            malam: [247001, 288437, 281482, 250794, 250554, 250433, 250432, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            manual: [247001, 288437, 281482, 250794, 250554, 250433, 250432, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170]
        },
        staging: {
            // 289627 adalah campaign lanjutan seperti 247001 di reguler
            pagi: [289626, 289627],
            siang: [289626, 289627],
            malam: [289626, 289627],
            manual: [289626, 289627]
        }
    },

    // Define special campaign and its excluded admins for debugging/logging purposes
    _specialCampaign: {
        regular: {
            id: 247001,
            excludedAdmins: ["admin 6", "admin 7", "admin 09", "admin 10", "admin 91", "admin 92"]
        },
        staging: {
            id: 289627,
            excludedAdmins: ["admin 6", "admin 7", "admin 09", "admin 10", "admin 91", "admin 92"]
        }
    },
    ALLOWED_ADMIN_NAMES: ["admin 1", "admin 2", "admin 3", "admin 4", "admin 5", "admin 6", "admin 7", "admin 8", "admin 09", "admin 10", "admin 91", "admin 92"],
    LOGIN_URL: 'https://app.loops.id/login',
    CAMPAIGN_BASE_URL: 'https://app.loops.id/campaign/',
    SERVER: {
        PORT: process.env.PORT || 3010,
        TIMEOUT: 600000 // 10 minutes
    },
    BROWSER: {
        ARGS: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    },
    JOB: {
        CLEANUP_TIMEOUT: 3600000 // 1 hour
    },

    USER_RULES: [],

    // --- START: Default Rules copied from config-more-enhanced.js ---
    _rules: {
        regular: [
            // Basic restrictions can be added here if needed
            {
                id: "restrict_admin1_to_only_campaign_247001",
                description: "Admin 1 can only process campaign 247001",
                condition: {
                    type: "AND",
                    conditions: [
                        { type: "ADMIN", value: "admin 1" },
                        { type: "CAMPAIGN", operator: "!=", value: 247001 }
                    ]
                },
                action: { type: "DENY" },
                priority: 1
            },
            {
                id: "exclude_admins_from_campaign_247001",
                description: "Admins 6, 7, 10, 91, 92 cannot process campaign 247001",
                condition: {
                    type: "AND",
                    conditions: [
                        { type: "ADMIN", operator: "IN", value: ["admin 6", "admin 7", "admin 09", "admin 10", "admin 91", "admin 92"] },
                        { type: "CAMPAIGN", value: 247001 }
                    ]
                },
                action: { type: "DENY" },
                priority: 1
            },
            // Conditional restriction: when admin 91 is present, admin 5 is restricted
            {
                id: "conditional_restriction_admin5_when_admin91",
                description: "When admin 91 is present, admin 5 can only process campaign 247001",
                condition: {
                    type: "AND",
                    conditions: [
                        { type: "ADMIN", value: "admin 5" },
                        { type: "CAMPAIGN", operator: "!=", value: 247001 },
                        { type: "ALL_SELECTED_ADMINS_CONTAINS", value: ["admin 91"] }
                    ]
                },
                action: { type: "DENY" },
                priority: 2
            },
            {
                id: "conditional_restriction_admin2_when_admin92",
                description: "When admin 92 is present, admin 2 is restricted and can only process campaign 247001",
                condition: {
                    type: "AND",
                    conditions: [
                        { type: "ADMIN", value: "admin 2" },
                        { type: "CAMPAIGN", operator: "!=", value: 247001 },
                        { type: "ALL_SELECTED_ADMINS_CONTAINS", value: ["admin 92"] }
                    ]
                },
                action: { type: "DENY" },
                priority: 2
            },
            // Special case: if admin 1, 5, and 91 are all present, an admin can be exempted
            {
                id: "exemption_when_all_special_admins_present",
                description: "When admin 1, 5, and 91 are all selected, admin 5 is always exempt from conditional restriction",
                condition: {
                    type: "AND",
                    conditions: [
                        { type: "ADMIN", value: "admin 5" }, // This rule now specifically targets admin 5
                        { type: "ALL_SELECTED_ADMINS_CONTAINS", value: ["admin 1", "admin 5", "admin 91"] }
                    ]
                },
                action: { type: "ALLOW_BYPASS" }, // A special action to bypass other rules
                priority: 3 // High priority to override other rules
            }
        ],
        staging: [
            // --- Rules below are duplicated from 'regular' and adapted for 'staging' environment ---
            {
                id: "restrict_admin1_to_only_campaign_289627_staging",
                description: "Admin 1 can only process campaign 289627",
                condition: {
                    type: "AND",
                    conditions: [
                        { type: "ADMIN", value: "admin 1" },
                        { type: "CAMPAIGN", operator: "!=", value: 289627 }
                    ]
                },
                action: { type: "DENY" },
                priority: 1
            },
            {
                id: "exclude_admins_from_campaign_289627_staging",
                description: "Admins 6, 7, 10, 91, 92 cannot process campaign 289627",
                condition: {
                    type: "AND",
                    conditions: [
                        { type: "ADMIN", operator: "IN", value: ["admin 6", "admin 7", "admin 09", "admin 10", "admin 91", "admin 92"] },
                        { type: "CAMPAIGN", value: 289627 }
                    ]
                },
                action: { type: "DENY" },
                priority: 1
            },
            // Conditional restriction: when admin 91 is present, admin 5 is restricted
            {
                id: "conditional_restriction_admin5_when_admin91_staging",
                description: "When admin 91 is present, admin 5 can only process campaign 289627",
                condition: {
                    type: "AND",
                    conditions: [
                        { type: "ADMIN", value: "admin 5" },
                        { type: "CAMPAIGN", operator: "!=", value: 289627 },
                        { type: "ALL_SELECTED_ADMINS_CONTAINS", value: ["admin 91"] }
                    ]
                },
                action: { type: "DENY" },
                priority: 2
            },
            {
                id: "conditional_restriction_admin2_when_admin92_staging",
                description: "When admin 92 is present, admin 2 is restricted and can only process campaign 289627",
                condition: {
                    type: "AND",
                    conditions: [
                        { type: "ADMIN", value: "admin 2" },
                        { type: "CAMPAIGN", operator: "!=", value: 289627 },
                        { type: "ALL_SELECTED_ADMINS_CONTAINS", value: ["admin 92"] }
                    ]
                },
                action: { type: "DENY" },
                priority: 2
            },
            // Special case: if admin 1, 5, and 91 are all present, an admin can be exempted
            {
                id: "exemption_when_all_special_admins_present_staging",
                description: "When admin 1, 5, and 91 are all selected, admin 5 is always exempt from conditional restriction",
                condition: {
                    type: "AND",
                    conditions: [
                        { type: "ADMIN", value: "admin 5" }, // This rule now specifically targets admin 5
                        { type: "ALL_SELECTED_ADMINS_CONTAINS", value: ["admin 1", "admin 5", "admin 91"] }
                    ]
                },
                action: { type: "ALLOW_BYPASS" }, // A special action to bypass other rules
                priority: 3 // High priority to override other rules
            }
        ]
    },

    evaluateDefaultRules: function(adminName, campaignId, allSelectedAdmins = [], exemptionSettings = {}) {
        // Use the active rules based on the environment
        const rulesToEvaluate = this.RULES;

        if (!Array.isArray(rulesToEvaluate)) {
            return true; // If no rules are defined for the context, allow by default.
        }

        const applicableRules = (rulesToEvaluate || [])
            .filter(rule => this.checkCondition(rule.condition, adminName, campaignId, allSelectedAdmins, exemptionSettings))
            .sort((a, b) => b.priority - a.priority);

        for (const rule of applicableRules) {
            if (rule.action.type === "ALLOW_BYPASS") {
                return true; // This rule grants a bypass, so we allow immediately.
            }
            if (rule.action.type === "DENY") {
                return false; // This rule denies access.
            }
        }
        return true; // No DENY rules matched, so allow by default.
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
        return allSelectedAdmins.includes(condition.value);
    },
    // --- END: Default Rules ---
    
    // Process admin rules based on the new payload structure
    processAdminRules: function(adminPayload, campaignId) {
        const { name, ruleType, campaignId: targetCampaignId } = adminPayload;
        
        // If ruleType and campaignId are null, admin processes all campaigns
        if (ruleType === null && targetCampaignId === null) {
            return true;
        }
        
        // Apply rule based on ruleType and campaignId
        if (ruleType === 'include') {
            // Admin can only process specific campaigns
            return parseInt(targetCampaignId) === parseInt(campaignId);
        } else if (ruleType === 'exclude') {
            // Admin cannot process specific campaigns
            return parseInt(targetCampaignId) !== parseInt(campaignId);
        }
        
        // Default behavior: admin can process all campaigns if no rule is specified
        return true;
    },
    
    // Check if an admin can process a campaign with the new payload structure
    canAdminProcessCampaign: function(adminName, campaignId, allSelectedAdmins, exemptionSettings = {}) {
        // Step 1: Check user-defined rules first.
        const userRule = (this.USER_RULES || []).find(r => r.admin === adminName);
        if (userRule) {
            const userRuleResult = this.processAdminRules(userRule, campaignId);
            // If a user rule exists and denies access, we stop here.
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

// Dynamically set the active campaign IDs and rules based on the environment
config.CAMPAIGN_IDS = config._campaignIds[config.activeEnv];
config.RULES = config._rules[config.activeEnv];
config.SPECIAL_CAMPAIGN = config._specialCampaign[config.activeEnv];

module.exports = config;
