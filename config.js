const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    CAMPAIGN_IDS: {
        regular: {
            pagi: [288437, 281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            siang: [288437, 281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            malam: [288437, 281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
            manual: [288437, 281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170]
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
    ADMIN_CAMPAIGN_RESTRICTIONS: {
        // include: admin can ONLY process these campaigns
        "admin 1": { include: [247001] }, // Admin 1 can ONLY process campaign 247001

        // exclude: admin cannot process these campaigns
        "admin 2": { exclude: [247001] }, // admin 2 cannot process campaign 247001
        "admin 6": { exclude: [247001] }, // admin 6 cannot process campaign 247001
        "admin 10": { exclude: [247001] }, // admin 10 cannot process campaign 247001
        "admin 91": { exclude: [247001] }, // admin 91 cannot process campaign 247001
        "admin 92": { exclude: [247001] }, // admin 92 cannot process campaign 247001
    },
    
    // Conditional restrictions: when admin 91 is present, admin 1 and 5 are restricted to only campaign 247001
    CONDITIONAL_RESTRICTIONS: {
        "admin 91": {
            whenPresent: {
                restrictSpecificAdmins: {
                    "admin 5": { include: [247001] }  // Admin 5 can only process 247001 when admin 91 is present
                },
                // Special case: if admin 1, 5, and 91 are all present, admin 5 is exempt from the restriction.
                ifAllPresent: {
                    admins: ["admin 1", "admin 5", "admin 91"],
                    exempt: ["admin 5"]
                }
            }
        },
        "admin 92": {
            whenPresent: {
                restrictSpecificAdmins: {
                    "admin 7": { include: [247001] } // Admin 7 can only process 247001 when admin 92 is present
                }
            }
        }
    },
    
    // Helper function to check if an admin can process a campaign
    canAdminProcessCampaign: function(adminName, campaignId, allSelectedAdmins = [], exemptionSettings = {}) {
        // Check conditional restrictions first
        const isAdmin91Present = allSelectedAdmins.includes("admin 91");
        const isAdmin92Present = allSelectedAdmins.includes("admin 92");

        // --- Conditional Restriction for admin 91 ---
        if (isAdmin91Present) {
            // Check for exemption first (e.g., when admin 1, 5, 91 are all selected)
            const specialCase = this.CONDITIONAL_RESTRICTIONS["admin 91"].whenPresent.ifAllPresent;
            const allSpecialAdminsPresent = specialCase && specialCase.admins.every(admin => allSelectedAdmins.includes(admin));

            if (allSpecialAdminsPresent && exemptionSettings.exemptAdmin === adminName) {
                // This admin is explicitly exempted. We can skip conditional checks for them
                // and proceed to the regular restrictions at the end of the function.
            } else {
                // If not exempt, apply the conditional restrictions for admin 91's presence.
                const conditionalRestrictions = this.CONDITIONAL_RESTRICTIONS["admin 91"].whenPresent.restrictSpecificAdmins;
                if (conditionalRestrictions[adminName]) {
                    // This admin has a conditional rule. They can ONLY process campaigns in the 'include' list.
                    return conditionalRestrictions[adminName].include.includes(campaignId);
                }
            }
        }

        // --- Conditional Restriction for admin 92 ---
        if (isAdmin92Present) {
            const restrictionsFor92 = this.CONDITIONAL_RESTRICTIONS["admin 92"]?.whenPresent?.restrictSpecificAdmins;
            if (restrictionsFor92 && restrictionsFor92[adminName]) {
                // This admin has a conditional rule. They can ONLY process campaigns in the 'include' list.
                const rule = restrictionsFor92[adminName];
                return rule.include.includes(campaignId);
            }
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
        
        // If it's an object with include property, admin can ONLY process these campaigns
        if (restrictions.include && Array.isArray(restrictions.include)) {
            return restrictions.include.includes(campaignId);
        }
        
        return true;
    },
    
    // Helper function to filter admins for a campaign
    getAdminsForCampaign: function(adminNames, campaignId, exemptionSettings) {
        return adminNames.filter(admin => this.canAdminProcessCampaign(admin, campaignId, adminNames, exemptionSettings));
    }
};