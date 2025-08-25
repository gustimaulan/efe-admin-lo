const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    CAMPAIGN_IDS: {
        regular: {
            pagi: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            siang: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            malam: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            manual: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170]
        }
    },
    ALLOWED_ADMIN_NAMES: ["admin 1", "admin 2", "admin 3", "admin 4", "admin 5", "admin 6", "admin 7", "admin 8", "admin 9", "admin 10", "admin 99"],
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
    ADMIN_CAMPAIGN_RESTRICTIONS: {
        "admin 2": { exclude: [247001] }, // admin 2 cannot process campaign 247001
        "admin 6": { exclude: [247001] }, // admin 6 cannot process campaign 247001
        "admin 7": { exclude: [247001] }, // admin 7 cannot process campaign 247001
        "admin 10": { exclude: [247001] }, // admin 10 cannot process campaign 247001
        "admin 99": { exclude: [247001] }, // admin 99 cannot process campaign 247001
    },
    
    // Conditional restrictions: when admin 99 is present, admin 1 and 5 are restricted to only campaign 247001
    CONDITIONAL_RESTRICTIONS: {
        "admin 99": {
            whenPresent: {
                restrictSpecificAdmins: {
                    "admin 1": { include: [247001] }, // Admin 1 can only process 247001 when admin 99 is present
                    "admin 5": { include: [247001] }  // Admin 5 can only process 247001 when admin 99 is present
                }
            }
        }
    },
    
    // Helper function to check if an admin can process a campaign
    canAdminProcessCampaign: function(adminName, campaignId, allSelectedAdmins = []) {
        // Check conditional restrictions first
        const isAdmin99Present = allSelectedAdmins.includes("admin 99");
        
        if (isAdmin99Present) {
            // If admin 99 is present, check if this admin has specific conditional restrictions
            const conditionalRestrictions = this.CONDITIONAL_RESTRICTIONS["admin 99"].whenPresent.restrictSpecificAdmins;
            if (conditionalRestrictions[adminName]) {
                // This admin has conditional restrictions - they can only process specific campaigns
                const conditionalRule = conditionalRestrictions[adminName];
                if (conditionalRule.include) {
                    return conditionalRule.include.includes(campaignId);
                }
            }
            // If admin doesn't have conditional restrictions, fall through to regular restrictions
        }
        
        // Apply regular restrictions
        const restrictions = this.ADMIN_CAMPAIGN_RESTRICTIONS[adminName];
        if (!restrictions) return true; // No restrictions for this admin
        
        // If it's an array, admin can ONLY process these campaigns
        if (Array.isArray(restrictions)) {
            return restrictions.includes(campaignId);
        }
        
        // If it's an object with exclude property, admin cannot process these campaigns
        if (restrictions.exclude && Array.isArray(restrictions.exclude)) {
            return !restrictions.exclude.includes(campaignId);
        }
        
        return true;
    },
    
    // Helper function to filter admins for a campaign
    getAdminsForCampaign: function(adminNames, campaignId) {
        return adminNames.filter(admin => this.canAdminProcessCampaign(admin, campaignId, adminNames));
    }
};