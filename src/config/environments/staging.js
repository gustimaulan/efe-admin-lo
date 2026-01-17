module.exports = {
    CAMPAIGN_IDS: {
        pagi: [289626, 289627],
        siang: [289626, 289627],
        malam: [289626, 289627],
        manual: [289626, 289627]
    },
    SPECIAL_CAMPAIGN: {
        id: 289627,
        excludedAdmins: ["admin 6", "admin 7", "admin 09", "admin 10", "admin 91", "admin 92", "admin 914", "admin 915", "admin 916", "admin 917", "admin 918"]
    },
    RULES: [
        // Rules for staging environment
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
            id: "restrict_admin5_to_only_campaign_289627_staging",
            description: "Admin 5 can only process campaign 289627",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 5" },
                    { type: "CAMPAIGN", operator: "!=", value: 289627 }
                ]
            },
            action: { type: "DENY" },
            priority: 1
        },
        {
            id: "restrict_admin2_to_only_campaign_289627_staging",
            description: "Admin 2 can only process campaign 289627",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 2" },
                    { type: "CAMPAIGN", operator: "!=", value: 289627 }
                ]
            },
            action: { type: "DENY" },
            priority: 1
        },
        {
            id: "exclude_admins_from_campaign_289627_staging",
            description: "Admins 6, 7, 10, 91, 92, 914, 915, 916, 917, 918 cannot process campaign 289627",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", operator: "IN", value: ["admin 6", "admin 7", "admin 09", "admin 10", "admin 91", "admin 92", "admin 914", "admin 915", "admin 916", "admin 917", "admin 918"] },
                    { type: "CAMPAIGN", value: 289627 }
                ]
            },
            action: { type: "DENY" },
            priority: 1
        },
    ]
};