const dotenv = require('dotenv');
dotenv.config();

// Enhanced configuration with new payload-based rule system
module.exports = {
    CAMPAIGN_IDS: {
        regular: {
            pagi: [288437, 281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            siang: [288437, 281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            malam: [288437, 281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            manual: [288437, 281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170]
        },
        staging: {
            // 289627 adalah campaign lanjutan seperti 247001 di reguler
            pagi: [289626, 289627],
            siang: [289626, 289627],
            malam: [289626, 289627],
            manual: [289626, 289627]
        }
    },
    ALLOWED_ADMIN_NAMES: ["admin 1", "admin 2", "admin 3", "admin 4", "admin 5", "admin 6", "admin 7", "admin 8", "admin 9", "admin 10", "admin 91", "admin 92"],
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

    // --- START: Default Rules copied from config-more-enhanced.js ---
    RULES: [
        // Basic exclusion rules for the STAGING campaign 289627 (equivalent to production's 247001)
        {
            id: "exclude_admin_10_campaign_289627",
            description: "Admin 10 cannot process campaign 289627",
            condition: { type: "AND", conditions: [{ type: "ADMIN", value: "admin 10" }, { type: "CAMPAIGN", value: 289627 }] },
            action: { type: "DENY" },
            priority: 1
        },
        {
            id: "exclude_admin_2_campaign_289627",
            description: "Admin 2 cannot process campaign 289627",
            condition: { type: "AND", conditions: [{ type: "ADMIN", value: "admin 2" }, { type: "CAMPAIGN", value: 289627 }] },
            action: { type: "DENY" },
            priority: 1
        },
        {
            id: "exclude_admin_6_campaign_289627",
            description: "Admin 6 cannot process campaign 289627",
            condition: { type: "AND", conditions: [{ type: "ADMIN", value: "admin 6" }, { type: "CAMPAIGN", value: 289627 }] },
            action: { type: "DENY" },
            priority: 1
        },
        {
            id: "exclude_admin_91_campaign_289627",
            description: "Admin 91 cannot process campaign 289627",
            condition: { type: "AND", conditions: [{ type: "ADMIN", value: "admin 91" }, { type: "CAMPAIGN", value: 289627 }] },
            action: { type: "DENY" },
            priority: 1
        },
        {
            id: "exclude_admin_92_campaign_289627",
            description: "Admin 92 cannot process campaign 289627",
            condition: { type: "AND", conditions: [{ type: "ADMIN", value: "admin 92" }, { type: "CAMPAIGN", value: 289627 }] },
            action: { type: "DENY" },
            priority: 1
        },
        // Admin 1 can only process campaign 289627
        {
            id: "admin_1_only_campaign_289627",
            description: "Admin 1 can only process campaign 289627",
            condition: { type: "AND", conditions: [{ type: "ADMIN", value: "admin 1" }, { type: "CAMPAIGN", operator: "!=", value: 289627 }] },
            action: { type: "DENY" },
            priority: 1
        },
        // Conditional restriction: when admin 91 is present, admin 5 is restricted
        {
            id: "conditional_restriction_admin5_when_admin91",
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

    evaluateDefaultRules: function(adminName, campaignId, allSelectedAdmins = [], exemptionSettings = {}) {
        const applicableRules = this.RULES
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
    canAdminProcessCampaign: function(adminName, campaignId, allAdminPayloads, exemptionSettings = {}) {
        // Step 1: Check the dynamic rules from the payload first.
        // If a dynamic rule explicitly denies access, we stop here.
        const adminPayload = allAdminPayloads.find(admin => admin.name === adminName);
        if (adminPayload) {
            const dynamicRuleResult = this.processAdminRules(adminPayload, campaignId);
            if (!dynamicRuleResult) {
                // Dynamic rule (e.g., include/exclude from UI) forbids this.
                return false;
            }
        }

        // Step 2: If dynamic rules allow, check against the hardcoded default rules.
        const allSelectedAdminNames = allAdminPayloads.map(p => p.name);
        const defaultRuleResult = this.evaluateDefaultRules(adminName, campaignId, allSelectedAdminNames, exemptionSettings);
        
        return defaultRuleResult;
    },
    
    // Get filtered admins for a specific campaign based on the new payload structure
    getAdminsForCampaign: function(adminPayloads, campaignId, exemptionSettings = {}) {
        return adminPayloads
            .filter(payload => this.canAdminProcessCampaign(payload.name, campaignId, adminPayloads, exemptionSettings))
            .map(payload => payload.name);
    }
};