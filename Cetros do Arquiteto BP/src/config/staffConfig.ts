export type StaffSpecialAbility =
    | "copper_oxidize"
    | "quartz_light"
    | "amethyst_telescope"
    | "redstone_wrench"
    | "prismarine_drain"
    | "emerald_master"
    | "obsidian_solidify"
    | "breeze_leap"
    | "end_blink"
    | "echo_angel";

const ALL_PATTERNS = [
    "connected", "line", "floor", "stairs", "overlay",
    "wall", "highway", "spiral", "box2p", "gable_roof",
    "battlement", "arch", "circle", "cylinder", "sphere",
    "dome", "torus", "cube", "pyramid"
];

export class StaffConfig {
    static identifiers: string[] = [
        "arc_st:stone_staff",
        "arc_st:copper_staff",
        "arc_st:iron_staff",
        "arc_st:gold_staff",
        "arc_st:quartz_staff",
        "arc_st:amethyst_staff",
        "arc_st:redstone_staff",
        "arc_st:prismarine_staff",
        "arc_st:diamond_staff",
        "arc_st:emerald_staff",
        "arc_st:obsidian_staff",
        "arc_st:netherite_staff",
        "arc_st:breeze_staff",
        "arc_st:end_staff",
        "arc_st:echo_staff",
        "arc_st:stone_des_staff",
        "arc_st:copper_des_staff",
        "arc_st:iron_des_staff",
        "arc_st:gold_des_staff",
        "arc_st:quartz_des_staff",
        "arc_st:amethyst_des_staff",
        "arc_st:redstone_des_staff",
        "arc_st:prismarine_des_staff",
        "arc_st:diamond_des_staff",
        "arc_st:emerald_des_staff",
        "arc_st:obsidian_des_staff",
        "arc_st:netherite_des_staff",
        "arc_st:breeze_des_staff",
        "arc_st:end_des_staff",
        "arc_st:echo_des_staff",
    ];

    private static baseMaxBlocks: Record<string, number> = {
        "arc_st:stone_staff": 25,
        "arc_st:copper_staff": 35,
        "arc_st:iron_staff": 50,
        "arc_st:gold_staff": 65,
        "arc_st:quartz_staff": 75,
        "arc_st:amethyst_staff": 80,
        "arc_st:redstone_staff": 90,
        "arc_st:prismarine_staff": 95,
        "arc_st:diamond_staff": 100,
        "arc_st:emerald_staff": 110,
        "arc_st:obsidian_staff": 120,
        "arc_st:netherite_staff": 125,
        "arc_st:breeze_staff": 135,
        "arc_st:end_staff": 150,
        "arc_st:echo_staff": 160,
    };

    private static baseMaxPatternSize: Record<string, number> = {
        "arc_st:stone_staff": 5,
        "arc_st:copper_staff": 6,
        "arc_st:iron_staff": 8,
        "arc_st:gold_staff": 10,
        "arc_st:quartz_staff": 11,
        "arc_st:amethyst_staff": 12,
        "arc_st:redstone_staff": 12,
        "arc_st:prismarine_staff": 13,
        "arc_st:diamond_staff": 12,
        "arc_st:emerald_staff": 14,
        "arc_st:obsidian_staff": 15,
        "arc_st:netherite_staff": 15,
        "arc_st:breeze_staff": 16,
        "arc_st:end_staff": 17,
        "arc_st:echo_staff": 18,
    };

    private static baseMaxReplaceArea: Record<string, number> = {
        "arc_st:stone_staff": 3,
        "arc_st:copper_staff": 4,
        "arc_st:iron_staff": 5,
        "arc_st:gold_staff": 6,
        "arc_st:quartz_staff": 7,
        "arc_st:amethyst_staff": 8,
        "arc_st:redstone_staff": 8,
        "arc_st:prismarine_staff": 9,
        "arc_st:diamond_staff": 9,
        "arc_st:emerald_staff": 12,
        "arc_st:obsidian_staff": 11,
        "arc_st:netherite_staff": 11,
        "arc_st:breeze_staff": 13,
        "arc_st:end_staff": 14,
        "arc_st:echo_staff": 15,
    };

    static maxBlocks: Record<string, number> = Object.fromEntries(
        StaffConfig.identifiers.map(id => [id, StaffConfig.baseMaxBlocks[id.replace("_des_staff", "_staff")] ?? 25])
    );

    static maxPatternSize: Record<string, number> = Object.fromEntries(
        StaffConfig.identifiers.map(id => [id, StaffConfig.baseMaxPatternSize[id.replace("_des_staff", "_staff")] ?? 5])
    );

    static maxReplaceArea: Record<string, number> = Object.fromEntries(
        StaffConfig.identifiers.map(id => [id, StaffConfig.baseMaxReplaceArea[id.replace("_des_staff", "_staff")] ?? 3])
    );

    static allowedPatterns: Record<string, string[]> = {
        "arc_st:stone_staff": ["connected", "line", "floor", "stairs", "overlay"],
        "arc_st:copper_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "highway", "spiral"],
        "arc_st:iron_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "highway", "spiral", "box2p", "gable_roof", "battlement", "arch", "circle", "cylinder"],
        "arc_st:gold_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "highway", "spiral", "box2p", "gable_roof", "battlement", "arch", "circle", "cylinder"],
        "arc_st:quartz_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "highway", "spiral", "box2p", "gable_roof", "battlement", "arch", "circle", "cylinder", "dome"],
        "arc_st:amethyst_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "highway", "spiral", "box2p", "gable_roof", "battlement", "arch", "circle", "cylinder", "sphere", "dome", "torus"],
        "arc_st:redstone_staff": ["connected", "line", "floor", "stairs", "overlay", "wall", "highway", "spiral", "box2p", "gable_roof", "battlement", "arch", "circle", "cylinder", "cube"],
        "arc_st:prismarine_staff": ALL_PATTERNS,
        "arc_st:diamond_staff": ALL_PATTERNS,
        "arc_st:emerald_staff": ALL_PATTERNS,
        "arc_st:obsidian_staff": ALL_PATTERNS,
        "arc_st:netherite_staff": ALL_PATTERNS,
        "arc_st:breeze_staff": ALL_PATTERNS,
        "arc_st:end_staff": ALL_PATTERNS,
        "arc_st:echo_staff": ALL_PATTERNS,
    };

    static getMaxBox2PVolume(staffTypeId: string): number {
        const baseMax = this.maxBlocks[staffTypeId] ?? 25;
        return Math.min(1800, baseMax * 10);
    }

    static getBaseStaffId(staffTypeId: string): string {
        return staffTypeId.replace("_des_staff", "_staff");
    }

    static getDestructionStaffId(staffTypeId: string): string {
        if (staffTypeId.endsWith("_des_staff")) return staffTypeId;
        return staffTypeId.replace("_staff", "_des_staff");
    }

    static canUsePattern(staffTypeId: string, pattern: string): boolean {
        const allowed = this.allowedPatterns[this.getBaseStaffId(staffTypeId)];
        return allowed ? allowed.includes(pattern) : false;
    }

    static isUnbreakable(staffTypeId: string): boolean {
        return this.getBaseStaffId(staffTypeId) === "arc_st:echo_staff";
    }

    static getViewDistance(staffTypeId: string): number {
        const base = this.getBaseStaffId(staffTypeId);
        if (base === "arc_st:echo_staff") return 110;
        if (base === "arc_st:amethyst_staff" || base === "arc_st:end_staff") return 100;
        if (base === "arc_st:breeze_staff") return 80;
        return 64;
    }

    static getMaxPaletteSize(staffTypeId: string): number {
        const base = this.getBaseStaffId(staffTypeId);
        if (base === "arc_st:emerald_staff" || base === "arc_st:end_staff" || base === "arc_st:echo_staff") return 9;
        if (base === "arc_st:obsidian_staff" || base === "arc_st:breeze_staff") return 8;
        return 6;
    }

    static getSpecialAbility(staffTypeId: string): StaffSpecialAbility | null {
        switch (this.getBaseStaffId(staffTypeId)) {
            case "arc_st:copper_staff": return "copper_oxidize";
            case "arc_st:quartz_staff": return "quartz_light";
            case "arc_st:amethyst_staff": return "amethyst_telescope";
            case "arc_st:redstone_staff": return "redstone_wrench";
            case "arc_st:prismarine_staff": return "prismarine_drain";
            case "arc_st:emerald_staff": return "emerald_master";
            case "arc_st:obsidian_staff": return "obsidian_solidify";
            case "arc_st:breeze_staff": return "breeze_leap";
            case "arc_st:end_staff": return "end_blink";
            case "arc_st:echo_staff": return "echo_angel";
            default: return null;
        }
    }

    static getStaffTierName(staffTypeId: string): string {
        return this.getBaseStaffId(staffTypeId).replace("arc_st:", "").replace("_staff", "").toUpperCase();
    }

    static isStaff(itemTypeId: string): boolean {
        return this.identifiers.includes(itemTypeId);
    }
}
