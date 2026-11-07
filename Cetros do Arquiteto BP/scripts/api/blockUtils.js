import { VectorUtils } from "./vectorUtils";
const SIMILAR_TERRAIN_GROUPS = [
    [
        "minecraft:stone", "minecraft:cobblestone", "minecraft:mossy_cobblestone",
        "minecraft:granite", "minecraft:diorite", "minecraft:andesite",
        "minecraft:tuff", "minecraft:calcite", "minecraft:deepslate",
        "minecraft:cobbled_deepslate", "minecraft:dripstone_block"
    ],
    [
        "minecraft:dirt", "minecraft:grass_block", "minecraft:grass",
        "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:mycelium",
        "minecraft:rooted_dirt", "minecraft:mud", "minecraft:dirt_path", "minecraft:grass_path"
    ],
    [
        "minecraft:sand", "minecraft:red_sand", "minecraft:sandstone",
        "minecraft:red_sandstone", "minecraft:gravel"
    ],
    [
        "minecraft:netherrack", "minecraft:crimson_nylium", "minecraft:warped_nylium",
        "minecraft:basalt", "minecraft:smooth_basalt", "minecraft:blackstone",
        "minecraft:soul_sand", "minecraft:soul_soil"
    ]
];
const COPPER_OXIDATION_CHAINS = [
    ["minecraft:copper_block", "minecraft:exposed_copper", "minecraft:weathered_copper", "minecraft:oxidized_copper"],
    ["minecraft:cut_copper", "minecraft:exposed_cut_copper", "minecraft:weathered_cut_copper", "minecraft:oxidized_cut_copper"],
    ["minecraft:cut_copper_stairs", "minecraft:exposed_cut_copper_stairs", "minecraft:weathered_cut_copper_stairs", "minecraft:oxidized_cut_copper_stairs"],
    ["minecraft:cut_copper_slab", "minecraft:exposed_cut_copper_slab", "minecraft:weathered_cut_copper_slab", "minecraft:oxidized_cut_copper_slab"],
    ["minecraft:chiseled_copper", "minecraft:exposed_chiseled_copper", "minecraft:weathered_chiseled_copper", "minecraft:oxidized_chiseled_copper"],
    ["minecraft:copper_grate", "minecraft:exposed_copper_grate", "minecraft:weathered_copper_grate", "minecraft:oxidized_copper_grate"],
    ["minecraft:copper_bulb", "minecraft:exposed_copper_bulb", "minecraft:weathered_copper_bulb", "minecraft:oxidized_copper_bulb"]
];
const WEATHERING_MAP = {
    "minecraft:stone_bricks": ["minecraft:mossy_stone_bricks", "minecraft:cracked_stone_bricks"],
    "minecraft:stonebrick": ["minecraft:mossy_stone_bricks", "minecraft:cracked_stone_bricks"],
    "minecraft:cobblestone": ["minecraft:mossy_cobblestone"],
    "minecraft:stone": ["minecraft:cobblestone", "minecraft:andesite", "minecraft:mossy_cobblestone"],
    "minecraft:deepslate_bricks": ["minecraft:cracked_deepslate_bricks", "minecraft:deepslate_tiles"],
    "minecraft:deepslate_tiles": ["minecraft:cracked_deepslate_tiles"],
    "minecraft:polished_blackstone_bricks": ["minecraft:cracked_polished_blackstone_bricks", "minecraft:blackstone"],
    "minecraft:nether_brick": ["minecraft:cracked_nether_bricks"],
    "minecraft:mud_bricks": ["minecraft:packed_mud"]
};
export class BlockUtils {
    static getReadableBlockName(blockId) {
        return blockId.replace("minecraft:", "").replace(/_/g, " ");
    }
    static areSimilarBlocks(targetType, candidateType) {
        if (targetType === candidateType)
            return true;
        for (const group of SIMILAR_TERRAIN_GROUPS) {
            if (group.includes(targetType) && group.includes(candidateType)) {
                return true;
            }
        }
        return false;
    }
    static transformCopperBlock(typeId, action) {
        const cleanId = typeId.replace("minecraft:waxed_", "minecraft:");
        if (action === "scrape" && typeId.startsWith("minecraft:waxed_")) {
            return cleanId;
        }
        for (const chain of COPPER_OXIDATION_CHAINS) {
            const idx = chain.indexOf(typeId);
            if (idx === -1)
                continue;
            if (action === "oxidize" && idx < chain.length - 1)
                return chain[idx + 1];
            if (action === "scrape" && idx > 0)
                return chain[idx - 1];
        }
        return null;
    }
    static cycleBlockOrientation(block) {
        if (this.hasContainerOrComplexData(block))
            return false;
        try {
            const perm = block.permutation;
            const states = perm.getAllStates();
            const cycleList = (key, values) => {
                if (!(key in states))
                    return false;
                const current = states[key];
                const idx = values.indexOf(current);
                const next = values[(idx + 1) % values.length];
                block.setPermutation(perm.withState(key, next));
                return true;
            };
            if ("weirdo_direction" in states) {
                const curDir = states["weirdo_direction"];
                if (curDir === 3 && "upside_down_bit" in states) {
                    const flipped = !states["upside_down_bit"];
                    block.setPermutation(perm.withState("weirdo_direction", 0)
                        .withState("upside_down_bit", flipped));
                    return true;
                }
                return cycleList("weirdo_direction", [0, 1, 2, 3]);
            }
            if (cycleList("minecraft:cardinal_direction", ["north", "east", "south", "west"]))
                return true;
            if (cycleList("pillar_axis", ["y", "x", "z"]))
                return true;
            if (cycleList("minecraft:vertical_half", ["bottom", "top"]))
                return true;
            if (cycleList("upside_down_bit", [false, true]))
                return true;
            if (cycleList("facing_direction", [0, 1, 2, 3, 4, 5]))
                return true;
            if (cycleList("direction", [0, 1, 2, 3]))
                return true;
        }
        catch { }
        return false;
    }
    static hasContainerOrComplexData(block) {
        try {
            if (block.getComponent("minecraft:inventory"))
                return true;
        }
        catch { }
        const id = block.typeId.replace("minecraft:", "");
        return id.endsWith("_bed") || id === "bed" ||
            id.endsWith("_door") || id === "iron_door" ||
            id.includes("piston") || id.includes("sign") ||
            id.includes("banner") || id.endsWith("_skull") ||
            id.endsWith("_head") || id === "beacon" ||
            id === "enchanting_table" || id === "lectern" ||
            id === "jukebox" || id === "bell" ||
            id === "flower_pot" || id === "decorated_pot" ||
            id === "chiseled_bookshelf" || id === "frame" ||
            id === "glow_frame" || id === "ender_chest" ||
            id.includes("shulker_box") || id === "bee_nest" ||
            id === "beehive" || id === "respawn_anchor";
    }
    static findSurfaceConnectedBlocks(start, blockType, face, maxCount, directionLock = "free", playerFacing = "north", matchSimilar = false) {
        const result = [];
        const queue = [start.location];
        const visited = new Set();
        const { dimension } = start;
        const faceNormal = VectorUtils.getFaceOffset(face);
        const constraintAxis = this.getConstraintAxis(faceNormal);
        const surfaceDirections = this.DIRECTIONS.filter(dir => {
            if (constraintAxis && dir[constraintAxis] !== 0) {
                return false;
            }
            if (directionLock === "free")
                return true;
            if (constraintAxis === "y") {
                const lookingNorthSouth = playerFacing === "north" || playerFacing === "south";
                if (directionLock === "horizontal") {
                    return lookingNorthSouth ? dir.z === 0 : dir.x === 0;
                }
                return lookingNorthSouth ? dir.x === 0 : dir.z === 0;
            }
            else {
                if (directionLock === "horizontal") {
                    return dir.y === 0;
                }
                return dir.x === 0 && dir.z === 0;
            }
        });
        while (queue.length > 0 && result.length < maxCount) {
            const current = queue.shift();
            const key = VectorUtils.getPositionKey(current);
            if (visited.has(key))
                continue;
            visited.add(key);
            result.push(current);
            for (const direction of surfaceDirections) {
                const neighborPos = {
                    x: current.x + direction.x,
                    y: current.y + direction.y,
                    z: current.z + direction.z
                };
                const posKey = VectorUtils.getPositionKey(neighborPos);
                if (visited.has(posKey))
                    continue;
                if (this.isMatchingBlock(dimension, neighborPos, blockType, matchSimilar)) {
                    queue.push(neighborPos);
                }
            }
        }
        return result;
    }
    static tryPlaceBlock(dimension, pos, permutation) {
        try {
            const block = dimension.getBlock(pos);
            if (block?.typeId === "minecraft:air") {
                block.setPermutation(permutation);
                return true;
            }
        }
        catch { }
        return false;
    }
    static getConstraintAxis(faceNormal) {
        const entries = Object.entries(faceNormal);
        return entries.find(([_, value]) => value !== 0)?.[0] || null;
    }
    static isMatchingBlock(dimension, pos, blockType, matchSimilar = false) {
        try {
            const block = dimension.getBlock(pos);
            if (!block)
                return false;
            return matchSimilar
                ? this.areSimilarBlocks(blockType, block.typeId)
                : block.typeId === blockType;
        }
        catch {
            return false;
        }
    }
    static isFoliageOrSnow(typeId, includeLeaves = false) {
        if (!typeId || typeId === "minecraft:air" || typeId.startsWith("arc_st:"))
            return false;
        const id = typeId.replace("minecraft:", "");
        if (includeLeaves && (id.endsWith("_leaves") || id.endsWith("_leaves2") ||
            id === "leaves" || id === "leaves2" ||
            id === "azalea_leaves" || id === "azalea_leaves_flowered" ||
            id === "mangrove_leaves" || id === "cherry_leaves" || id === "pale_oak_leaves")) {
            return true;
        }
        const exactFoliage = new Set([
            "short_grass", "tallgrass", "fern", "large_fern", "double_plant",
            "deadbush", "dead_bush", "vine", "cave_vines",
            "cave_vines_body_with_berries", "cave_vines_head_with_berries",
            "glow_lichen", "hanging_roots", "spore_blossom", "moss_carpet",
            "pink_petals", "leaf_litter", "bush", "firefly_bush",
            "short_dry_grass", "tall_dry_grass", "wildflowers",
            "snow_layer", "bamboo", "bamboo_sapling", "sugar_cane",
            "sweet_berry_bush", "waterlily", "seagrass", "tall_seagrass",
            "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet",
            "red_tulip", "orange_tulip", "white_tulip", "pink_tulip",
            "oxeye_daisy", "cornflower", "lily_of_the_valley", "wither_rose",
            "torchflower", "pitcher_plant", "closed_eyeblossom", "open_eyeblossom",
            "red_flower", "yellow_flower", "brown_mushroom", "red_mushroom",
            "crimson_fungus", "warped_fungus", "crimson_roots", "warped_roots",
            "nether_sprouts", "twisting_vines", "weeping_vines", "azalea", "flowering_azalea"
        ]);
        if (exactFoliage.has(id))
            return true;
        return id.endsWith("_sapling") || id.includes("flower");
    }
    static getWeatheredVariants(typeId) {
        return WEATHERING_MAP[typeId] ?? [];
    }
    static getAutoOrientedPermutation(basePerm, pattern, player, pos, center, extra) {
        let perm = basePerm;
        try {
            const states = perm.getAllStates();
            if (pattern === "stairs" && "weirdo_direction" in states) {
                const v = player.getViewDirection();
                const facing = Math.abs(v.x) > Math.abs(v.z)
                    ? (v.x > 0 ? "east" : "west")
                    : (v.z > 0 ? "south" : "north");
                const isUp = (extra?.stairsDir ?? "up") === "up";
                const upMap = { east: 0, west: 1, south: 2, north: 3 };
                const downMap = { east: 1, west: 0, south: 3, north: 2 };
                const wDir = isUp ? upMap[facing] : downMap[facing];
                perm = perm.withState("weirdo_direction", wDir);
                if ("upside_down_bit" in states) {
                    perm = perm.withState("upside_down_bit", false);
                }
            }
            else if (pattern === "pyramid" && "weirdo_direction" in states) {
                const dx = pos.x - Math.floor(center.x);
                const dz = pos.z - Math.floor(center.z);
                if (dx !== 0 || dz !== 0) {
                    let wDir = 0;
                    if (Math.abs(dx) >= Math.abs(dz)) {
                        wDir = dx > 0 ? 1 : 0;
                    }
                    else {
                        wDir = dz > 0 ? 3 : 2;
                    }
                    perm = perm.withState("weirdo_direction", wDir);
                    if ("upside_down_bit" in states) {
                        perm = perm.withState("upside_down_bit", Boolean(extra?.inverted));
                    }
                }
            }
            else if (pattern === "gable_roof" && "weirdo_direction" in states) {
                const v = player.getViewDirection();
                const facingNorthSouth = Math.abs(v.z) >= Math.abs(v.x);
                if (facingNorthSouth) {
                    const dx = pos.x - Math.floor(center.x);
                    if (dx !== 0) {
                        const wDir = dx > 0 ? 1 : 0;
                        perm = perm.withState("weirdo_direction", wDir);
                    }
                }
                else {
                    const dz = pos.z - Math.floor(center.z);
                    if (dz !== 0) {
                        const wDir = dz > 0 ? 3 : 2;
                        perm = perm.withState("weirdo_direction", wDir);
                    }
                }
            }
            else if (pattern === "spiral") {
                const dx = pos.x - Math.floor(center.x);
                const dz = pos.z - Math.floor(center.z);
                if (dx === 0 && dz === 0 && "pillar_axis" in states) {
                    perm = perm.withState("pillar_axis", "y");
                }
                else if ("weirdo_direction" in states && (dx !== 0 || dz !== 0)) {
                    const cw = extra?.clockwise ?? true;
                    const tx = cw ? -dz : dz;
                    const tz = cw ? dx : -dx;
                    const wDir = Math.abs(tx) >= Math.abs(tz)
                        ? (tx >= 0 ? 0 : 1)
                        : (tz >= 0 ? 2 : 3);
                    perm = perm.withState("weirdo_direction", wDir);
                }
            }
            else if (pattern === "line" && "pillar_axis" in states && extra?.lineDir) {
                const ax = Math.abs(extra.lineDir.x);
                const ay = Math.abs(extra.lineDir.y);
                const az = Math.abs(extra.lineDir.z);
                const axis = (ax >= ay && ax >= az) ? "x" : (az >= ay && az >= ax) ? "z" : "y";
                perm = perm.withState("pillar_axis", axis);
            }
            else if (pattern === "box2p" && "pillar_axis" in states && extra?.frameBounds) {
                const b = extra.frameBounds;
                const onX = pos.x === b.minX || pos.x === b.maxX;
                const onY = pos.y === b.minY || pos.y === b.maxY;
                const onZ = pos.z === b.minZ || pos.z === b.maxZ;
                if (onX && onZ) {
                    perm = perm.withState("pillar_axis", "y");
                }
                else if (onY && onZ) {
                    perm = perm.withState("pillar_axis", "x");
                }
                else if (onY && onX) {
                    perm = perm.withState("pillar_axis", "z");
                }
            }
        }
        catch { }
        return perm;
    }
    static rotateBlockStates(states, rotationDeg, mirrorX) {
        const out = { ...states };
        if (mirrorX) {
            if (typeof out["weirdo_direction"] === "number") {
                const cur = out["weirdo_direction"];
                if (cur === 0)
                    out["weirdo_direction"] = 1;
                else if (cur === 1)
                    out["weirdo_direction"] = 0;
            }
            if (typeof out["minecraft:cardinal_direction"] === "string") {
                const cur = out["minecraft:cardinal_direction"];
                if (cur === "east")
                    out["minecraft:cardinal_direction"] = "west";
                else if (cur === "west")
                    out["minecraft:cardinal_direction"] = "east";
            }
            if (typeof out["minecraft:facing_direction"] === "string") {
                const cur = out["minecraft:facing_direction"];
                if (cur === "east")
                    out["minecraft:facing_direction"] = "west";
                else if (cur === "west")
                    out["minecraft:facing_direction"] = "east";
            }
            if (typeof out["facing_direction"] === "number") {
                const cur = out["facing_direction"];
                if (cur === 4)
                    out["facing_direction"] = 5;
                else if (cur === 5)
                    out["facing_direction"] = 4;
            }
            if (typeof out["direction"] === "number") {
                const cur = out["direction"];
                if (cur === 1)
                    out["direction"] = 3;
                else if (cur === 3)
                    out["direction"] = 1;
            }
        }
        const steps = ((rotationDeg / 90) % 4 + 4) % 4;
        const weirdoCycle = { 0: 2, 2: 1, 1: 3, 3: 0 };
        const cardinalCycle = { north: "east", east: "south", south: "west", west: "north" };
        const facingNumCycle = { 2: 5, 5: 3, 3: 4, 4: 2 };
        const dirNumCycle = { 2: 3, 3: 0, 0: 1, 1: 2 };
        for (let s = 0; s < steps; s++) {
            if (typeof out["weirdo_direction"] === "number") {
                const cur = out["weirdo_direction"];
                if (cur in weirdoCycle)
                    out["weirdo_direction"] = weirdoCycle[cur];
            }
            if (typeof out["minecraft:cardinal_direction"] === "string") {
                const cur = out["minecraft:cardinal_direction"];
                if (cur in cardinalCycle)
                    out["minecraft:cardinal_direction"] = cardinalCycle[cur];
            }
            if (typeof out["minecraft:facing_direction"] === "string") {
                const cur = out["minecraft:facing_direction"];
                if (cur in cardinalCycle)
                    out["minecraft:facing_direction"] = cardinalCycle[cur];
            }
            if (typeof out["facing_direction"] === "number") {
                const cur = out["facing_direction"];
                if (cur in facingNumCycle)
                    out["facing_direction"] = facingNumCycle[cur];
            }
            if (typeof out["direction"] === "number") {
                const cur = out["direction"];
                if (cur in dirNumCycle)
                    out["direction"] = dirNumCycle[cur];
            }
            if (typeof out["pillar_axis"] === "string") {
                const cur = out["pillar_axis"];
                if (cur === "x")
                    out["pillar_axis"] = "z";
                else if (cur === "z")
                    out["pillar_axis"] = "x";
            }
        }
        return out;
    }
}
BlockUtils.DIRECTIONS = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }
];
