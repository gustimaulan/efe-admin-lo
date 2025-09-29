const dotenv = require('dotenv');
dotenv.config();

// Enhanced configuration with rule-based system
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
    
    // Enhanced rule-based system
    RULES: [
        // Basic exclusion rules
        {
            id: "exclude_admin_10_campaign_247001",
            description: "Admin 10 cannot process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 10" },
                    { type: "CAMPAIGN", value: 247001 }
                ]
            },
            action: { 
                type: "DENY" 
            },
            priority: 1
        },
        {
            id: "exclude_admin_2_campaign_247001",
            description: "Admin 2 cannot process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 2" },
                    { type: "CAMPAIGN", value: 247001 }
                ]
            },
            action: { 
                type: "DENY" 
            },
            priority: 1
        },
        {
            id: "exclude_admin_6_campaign_247001",
            description: "Admin 6 cannot process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 6" },
                    { type: "CAMPAIGN", value: 247001 }
                ]
            },
            action: { 
                type: "DENY" 
            },
            priority: 1
        },
        {
            id: "exclude_admin_91_campaign_247001",
            description: "Admin 91 cannot process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 91" },
                    { type: "CAMPAIGN", value: 247001 }
                ]
            },
            action: { 
                type: "DENY" 
            },
            priority: 1
        },
        {
            id: "exclude_admin_92_campaign_247001",
            description: "Admin 92 cannot process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 92" },
                    { type: "CAMPAIGN", value: 247001 }
                ]
            },
            action: { 
                type: "DENY" 
            },
            priority: 1
        },
        
        // Admin 1 can only process campaign 247001
        {
            id: "admin_1_only_campaign_247001",
            description: "Admin 1 can only process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 1" },
                    { type: "CAMPAIGN", operator: "!=", value: 247001 } // Any campaign except 247001
                ]
            },
            action: { 
                type: "DENY" 
            },
            priority: 1
        },
        
        // Conditional restriction: when admin 91 is present
        {
            id: "conditional_restriction_admin5_when_admin91",
            description: "When admin 91 is present, admin 5 can only process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 5" },
                    { type: "CAMPAIGN", operator: "!=", value: 247001 }, // Any campaign except 247001
                    { type: "ALL_SELECTED_ADMINS_CONTAINS", value: ["admin 91"] } // Admin 91 is present in selection
                ]
            },
            action: { 
                type: "DENY" 
            },
            priority: 2
        },
        
        // Special case: if admin 1, 5, and 91 are all present, admin 5 is exempt from the restriction
        {
            id: "exemption_admin5_when_all_special_admins_present",
            description: "When admin 1, 5, and 91 are all selected, admin 5 is exempt from conditional restriction",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 5" },
                    { type: "ALL_SELECTED_ADMINS_CONTAINS", value: ["admin 1", "admin 5", "admin 91"] } // All three are present
                ]
            },
            action: { 
                type: "EXEMPT_FROM_PREVIOUS_RULES" 
            },
            priority: 3
        },
        
        // Conditional restriction: when admin 92 is present
        {
            id: "conditional_restriction_admin7_when_admin92",
            description: "When admin 92 is present, admin 7 can only process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 7" },
                    { type: "CAMPAIGN", operator: "!=", value: 247001 }, // Any campaign except 247001
                    { type: "ALL_SELECTED_ADMINS_CONTAINS", value: ["admin 92"] } // Admin 92 is present in selection
                ]
            },
            action: { 
                type: "DENY" 
            },
            priority: 2
        },
        
        // Additional example: restriction based on number of admins
        {
            id: "limit_campaign_247001_to_3_admins",
            description: "Campaign 247001 can only be processed by maximum 3 admins at once",
            condition: {
                type: "AND",
                conditions: [
                    { type: "CAMPAIGN", value: 247001 },
                    { type: "ALL_SELECTED_ADMINS_COUNT_GREATER_THAN", value: 3 }
                ]
            },
            action: { 
                type: "DENY" 
            },
            priority: 1
        }
    ],
    
    // Enhanced rule evaluation function
    evaluateRules: function(adminName, campaignId, allSelectedAdmins = [], exemptionSettings = {}) {
        // Apply all rules and sort by priority
        const applicableRules = this.RULES.filter(rule => {
            return this.checkCondition(rule.condition, adminName, campaignId, allSelectedAdmins, exemptionSettings);
        }).sort((a, b) => b.priority - a.priority); // Higher priority first
        
        // Process rules in priority order
        for (const rule of applicableRules) {
            if (rule.action.type === "DENY") {
                return false; // Admin cannot process this campaign
            } else if (rule.action.type === "EXEMPT_FROM_PREVIOUS_RULES") {
                // If this exemption applies, we'll return true to bypass previous DENY rules
                return true;
            }
        }
        
        // If no DENY rules applied, allow by default
        return true;
    },
    
    // Helper function to check conditions
    checkCondition: function(condition, adminName, campaignId, allSelectedAdmins, exemptionSettings) {
        switch (condition.type) {
            case "AND":
                return condition.conditions.every(subCondition => 
                    this.checkCondition(subCondition, adminName, campaignId, allSelectedAdmins, exemptionSettings)
                );
            case "OR":
                return condition.conditions.some(subCondition => 
                    this.checkCondition(subCondition, adminName, campaignId, allSelectedAdmins, exemptionSettings)
                );
            case "NOT":
                return !this.checkCondition(condition.condition, adminName, campaignId, allSelectedAdmins, exemptionSettings);
            case "ADMIN":
                return this.checkAdminCondition(condition, adminName);
            case "CAMPAIGN":
                return this.checkCampaignCondition(condition, campaignId);
            case "ALL_SELECTED_ADMINS_CONTAINS":
                return this.checkAllSelectedAdminsContainsCondition(condition, allSelectedAdmins);
            case "ALL_SELECTED_ADMINS_COUNT_GREATER_THAN":
                return this.checkAllSelectedAdminsCountCondition(condition, allSelectedAdmins);
            default:
                return false;
        }
    },
    
    // Check admin condition
    checkAdminCondition: function(condition, adminName) {
        if (condition.operator === "!=") {
            return adminName !== condition.value;
        } else if (condition.operator === "IN") {
            return condition.value.includes(adminName);
        } else {
            return adminName === condition.value;
        }
    },
    
    // Check campaign condition
    checkCampaignCondition: function(condition, campaignId) {
        if (condition.operator === "!=") {
            return campaignId !== condition.value;
        } else if (condition.operator === "IN") {
            return condition.value.includes(campaignId);
        } else {
            return campaignId === condition.value;
        }
    },
    
    // Check if all selected admins contain specific admins
    checkAllSelectedAdminsContainsCondition: function(condition, allSelectedAdmins) {
        if (Array.isArray(condition.value)) {
            return condition.value.every(admin => allSelectedAdmins.includes(admin));
        } else {
            return allSelectedAdmins.includes(condition.value);
        }
    },
    
    // Check if all selected admins count is greater than specified value
    checkAllSelectedAdminsCountCondition: function(condition, allSelectedAdmins) {
        return allSelectedAdmins.length > condition.value;
    },
    
    // Updated function to check if an admin can process a campaign
    canAdminProcessCampaign: function(adminName, campaignId, allSelectedAdmins = [], exemptionSettings = {}) {
        return this.evaluateRules(adminName, campaignId, allSelectedAdmins, exemptionSettings);
    },
    
    // Updated function to filter admins for a campaign
    getAdminsForCampaign: function(adminNames, campaignId, exemptionSettings) {
        return adminNames.filter(admin => this.canAdminProcessCampaign(admin, campaignId, adminNames, exemptionSettings));
    }
};