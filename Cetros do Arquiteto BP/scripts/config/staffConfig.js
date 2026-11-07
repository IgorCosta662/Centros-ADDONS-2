const ALL_PATTERNS = [
    "connected", "line", "floor", "stairs", "overlay",
    "wall", "spiral", "box2p", "gable_roof", "arch",
    "circle", "cylinder", "sphere", "dome", "torus",
    "cube", "pyramid"
];
export class StaffConfig {
    static getMaxBox2PVolume(staffTypeId) {
        const baseMax = this.maxBlocks[staffTypeId] ?? 20;
        return Math.min(1600, baseMax * 10);
    }
    static getBaseStaffId(staffTypeId) {
        return staffTypeId.replace("_des_staff", "_staff");
    }
    static getDestructionStaffId(staffTypeId) {
        if (staffTypeId.endsWith("_des_staff"))
            return staffTypeId;
        return staffTypeId.replace("_staff", "_des_staff");
    }
    static canUsePattern(staffTypeId, pattern) {
        const allowed = this.allowedPatterns[this.getBaseStaffId(staffTypeId)];
        return allowed ? allowed.includes(pattern) : false;
    }
    static isUnbreakable(staffTypeId) {
        return this.getBaseStaffId(staffTypeId) === "arc_st:echo_staff";
    }
    static getViewDistance(staffTypeId) {
        const base = this.getBaseStaffId(staffTypeId);
        if (base === "arc_st:echo_staff")
            return 110;
        if (base === "arc_st:amethyst_staff")
            return 100;
        return 64;
    }
    static getMaxPaletteSize(staffTypeId) {
        const base = this.getBaseStaffId(staffTypeId);
        if (base === "arc_st:emerald_staff" || base === "arc_st:echo_staff")
            return 9;
        return 6;
    }
    static getSpecialAbility(staffTypeId) {
        switch (this.getBaseStaffId(staffTypeId)) {
            case "arc_st:copper_staff": return "copper_oxidize";
            case "arc_st:amethyst_staff": return "amethyst_telescope";
            case "arc_st:redstone_staff": return "redstone_wrench";
            case "arc_st:prismarine_staff": return "prismarine_drain";
            case "arc_st:emerald_staff": return "emerald_master";
            case "arc_st:echo_staff": return "echo_angel";
            default: return null;
        }
    }
    static getStaffTierName(staffTypeId) {
        return this.getBaseStaffId(staffTypeId).replace("arc_st:", "").replace("_staff", "").toUpperCase();
    }
    static isStaff(itemTypeId) {
        return this.identifiers.includes(itemTypeId);
    }
}
StaffConfig.identifiers = [
    "arc_st:stone_staff",
    "arc_st:copper_staff",
    "arc_st:iron_staff",
    "arc_st:gold_staff",
    "arc_st:amethyst_staff",
    "arc_st:redstone_staff",
    "arc_st:prismarine_staff",
    "arc_st:diamond_staff",
    "arc_st:emerald_staff",
    "arc_st:netherite_staff",
    "arc_st:echo_staff",
    "arc_st:stone_des_staff",
    "arc_st:copper_des_staff",
    "arc_st:iron_des_staff",
    "arc_st:gold_des_staff",
    "arc_st:amethyst_des_staff",
    "arc_st:redstone_des_staff",
    "arc_st:prismarine_des_staff",
    "arc_st:diamond_des_staff",
    "arc_st:emerald_des_staff",
    "arc_st:netherite_des_staff",
    "arc_st:echo_des_staff",
];
StaffConfig.baseMaxBlocks = {
    "arc_st:stone_staff": 20,
    "arc_st:copper_staff": 30,
    "arc_st:iron_staff": 40,
    "arc_st:gold_staff": 35,
    "arc_st:amethyst_staff": 50,
    "arc_st:redstone_staff": 55,
    "arc_st:prismarine_staff": 65,
    "arc_st:diamond_staff": 60,
    "arc_st:emerald_staff": 70,
    "arc_st:netherite_staff": 85,
    "arc_st:echo_staff": 160,
};
StaffConfig.baseMaxPatternSize = {
    "arc_st:stone_staff": 5,
    "arc_st:copper_staff": 6,
    "arc_st:iron_staff": 8,
    "arc_st:gold_staff": 7,
    "arc_st:amethyst_staff": 10,
    "arc_st:redstone_staff": 10,
    "arc_st:prismarine_staff": 12,
    "arc_st:diamond_staff": 12,
    "arc_st:emerald_staff": 14,
    "arc_st:netherite_staff": 16,
    "arc_st:echo_staff": 25,
};
StaffConfig.baseMaxReplaceArea = {
    "arc_st:stone_staff": 3,
    "arc_st:copper_staff": 4,
    "arc_st:iron_staff": 5,
    "arc_st:gold_staff": 5,
    "arc_st:amethyst_staff": 6,
    "arc_st:redstone_staff": 7,
    "arc_st:prismarine_staff": 8,
    "arc_st:diamond_staff": 8,
    "arc_st:emerald_staff": 12,
    "arc_st:netherite_staff": 10,
    "arc_st:echo_staff": 15,
};
StaffConfig.maxBlocks = Object.fromEntries(StaffConfig.identifiers.map(id => [id, StaffConfig.baseMaxBlocks[id.replace("_des_staff", "_staff")] ?? 20]));
StaffConfig.maxPatternSize = Object.fromEntries(StaffConfig.identifiers.map(id => [id, StaffConfig.baseMaxPatternSize[id.replace("_des_staff", "_staff")] ?? 5]));
StaffConfig.maxReplaceArea = Object.fromEntries(StaffConfig.identifiers.map(id => [id, StaffConfig.baseMaxReplaceArea[id.replace("_des_staff", "_staff")] ?? 3]));
StaffConfig.allowedPatterns = {
    "arc_st:stone_staff": ["connected", "line", "floor", "stairs", "overlay"],
    "arc_st:copper_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "spiral"],
    "arc_st:iron_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "spiral", "box2p", "gable_roof", "arch", "circle", "cylinder"],
    "arc_st:gold_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "spiral", "box2p", "gable_roof", "arch", "circle", "cylinder"],
    "arc_st:amethyst_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "spiral", "box2p", "gable_roof", "arch", "circle", "cylinder", "sphere", "dome", "torus"],
    "arc_st:redstone_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "spiral", "box2p", "gable_roof", "arch", "circle", "cylinder", "cube"],
    "arc_st:prismarine_staff": ALL_PATTERNS,
    "arc_st:diamond_staff": ALL_PATTERNS,
    "arc_st:emerald_staff": ALL_PATTERNS,
    "arc_st:netherite_staff": ALL_PATTERNS,
    "arc_st:echo_staff": ALL_PATTERNS,
};
