module.exports = {
    CAMPAIGN_IDS: {
        pagi: [247001, 288437, 281482, 250794, 250554, 250433, 250432, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
        siang: [247001, 288437, 281482, 250794, 250554, 250433, 250432, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
        malam: [247001, 288437, 281482, 250794, 250554, 250433, 250432, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170],
        manual: [247001, 288437, 281482, 250794, 250554, 250433, 250432, 246860, 246815, 246551, 246550, 246549, 246548, 249397, 275170]
    },
    SPECIAL_CAMPAIGN: {
        id: 247001,
        excludedAdmins: ["admin 6", "admin 7", "admin 09", "admin 10", "admin 91", "admin 92", "admin 914", "admin 915", "admin 916", "admin 917", "admin 918"]
    },
    RULES: [
        // Basic restrictions for development
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
            id: "restrict_admin5_to_only_campaign_247001",
            description: "Admin 5 can only process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 5" },
                    { type: "CAMPAIGN", operator: "!=", value: 247001 }
                ]
            },
            action: { type: "DENY" },
            priority: 1
        },
        {
            id: "restrict_admin2_to_only_campaign_247001",
            description: "Admin 2 can only process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", value: "admin 2" },
                    { type: "CAMPAIGN", operator: "!=", value: 247001 }
                ]
            },
            action: { type: "DENY" },
            priority: 1
        },
        {
            id: "exclude_admins_from_campaign_247001",
            description: "Admins 6, 7, 10, 91, 92, 914, 915, 916, 917, 918 cannot process campaign 247001",
            condition: {
                type: "AND",
                conditions: [
                    { type: "ADMIN", operator: "IN", value: ["admin 6", "admin 7", "admin 09", "admin 10", "admin 91", "admin 92", "admin 914", "admin 915", "admin 916", "admin 917", "admin 918"] },
                    { type: "CAMPAIGN", value: 247001 }
                ]
            },
            action: { type: "DENY" },
            priority: 1
        }
    ]
};