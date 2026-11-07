import { Block, Container, EntityComponentTypes, GameMode, ItemComponentTypes, ItemStack, Player } from "@minecraft/server";
import { StaffConfig } from "../config/staffConfig";
import { MessageUtils } from "./messageUtils";
import { PlayerPatternSettings } from "./models/playerPatternSettings";
import { SupplyChestLocation } from "./models/patternTypes";

const ORE_DROP_MAP: Record<string, string> = {
    "minecraft:coal_ore": "minecraft:coal",
    "minecraft:deepslate_coal_ore": "minecraft:coal",
    "minecraft:iron_ore": "minecraft:raw_iron",
    "minecraft:deepslate_iron_ore": "minecraft:raw_iron",
    "minecraft:copper_ore": "minecraft:raw_copper",
    "minecraft:deepslate_copper_ore": "minecraft:raw_copper",
    "minecraft:gold_ore": "minecraft:raw_gold",
    "minecraft:deepslate_gold_ore": "minecraft:raw_gold",
    "minecraft:nether_gold_ore": "minecraft:gold_nugget",
    "minecraft:diamond_ore": "minecraft:diamond",
    "minecraft:deepslate_diamond_ore": "minecraft:diamond",
    "minecraft:emerald_ore": "minecraft:emerald",
    "minecraft:deepslate_emerald_ore": "minecraft:emerald",
    "minecraft:lapis_ore": "minecraft:lapis_lazuli",
    "minecraft:deepslate_lapis_ore": "minecraft:lapis_lazuli",
    "minecraft:redstone_ore": "minecraft:redstone",
    "minecraft:deepslate_redstone_ore": "minecraft:redstone",
    "minecraft:lit_redstone_ore": "minecraft:redstone",
    "minecraft:lit_deepslate_redstone_ore": "minecraft:redstone",
    "minecraft:quartz_ore": "minecraft:quartz",
    "minecraft:stone": "minecraft:cobblestone",
    "minecraft:deepslate": "minecraft:cobbled_deepslate",
    "minecraft:grass_block": "minecraft:dirt",
    "minecraft:grass": "minecraft:dirt",
    "minecraft:mycelium": "minecraft:dirt",
    "minecraft:podzol": "minecraft:dirt",
    "minecraft:farmland": "minecraft:dirt",
    "minecraft:dirt_path": "minecraft:dirt",
    "minecraft:grass_path": "minecraft:dirt",
};

const NON_DROPPABLE_BLOCKS = new Set<string>([
    "minecraft:air",
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:lava",
    "minecraft:flowing_lava",
    "minecraft:fire",
    "minecraft:soul_fire",
    "minecraft:ice",
    "minecraft:frosted_ice",
    "minecraft:snow_layer",
    "minecraft:tallgrass",
    "minecraft:short_grass",
    "minecraft:double_plant",
    "minecraft:large_fern",
    "minecraft:fern",
    "minecraft:deadbush",
    "minecraft:vine",
    "minecraft:amethyst_cluster",
    "minecraft:large_amethyst_bud",
    "minecraft:medium_amethyst_bud",
    "minecraft:small_amethyst_bud",
]);

export class InventoryUtils {
    static readonly SUPPLY_CHEST_MAX_RANGE = 100;
    static readonly TORCH_CANDIDATES = [
        "minecraft:torch",
        "minecraft:lantern",
        "minecraft:soul_torch",
        "minecraft:soul_lantern"
    ];

    static getPlayerInventory(player: Player) {
        return player.getComponent(EntityComponentTypes.Inventory);
    }

    static isLinkableContainer(block: Block): boolean {
        return block.typeId === "minecraft:chest" ||
            block.typeId === "minecraft:trapped_chest" ||
            block.typeId === "minecraft:barrel";
    }

    static getSupplyChestStatus(player: Player): {
        linked: boolean;
        inRange: boolean;
        validBlock: boolean;
        distance: number;
        coords: SupplyChestLocation | null;
        container: Container | null;
    } {
        const coords = PlayerPatternSettings.getSupplyChest(player.name);
        if (!coords) {
            return { linked: false, inRange: false, validBlock: false, distance: 0, coords: null, container: null };
        }
        if (coords.dimensionId !== player.dimension.id) {
            return { linked: true, inRange: false, validBlock: false, distance: 999, coords, container: null };
        }
        const dx = player.location.x - (coords.x + 0.5);
        const dy = player.location.y - (coords.y + 0.5);
        const dz = player.location.z - (coords.z + 0.5);
        const distance = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));
        if (distance > this.SUPPLY_CHEST_MAX_RANGE) {
            return { linked: true, inRange: false, validBlock: false, distance, coords, container: null };
        }
        try {
            const block = player.dimension.getBlock({ x: coords.x, y: coords.y, z: coords.z });
            if (!block || !this.isLinkableContainer(block)) {
                return { linked: true, inRange: true, validBlock: false, distance, coords, container: null };
            }
            const invComp = block.getComponent("minecraft:inventory") as { container?: Container } | undefined;
            const container = invComp?.container ?? null;
            return { linked: true, inRange: true, validBlock: container !== null, distance, coords, container };
        } catch {
            return { linked: true, inRange: false, validBlock: false, distance, coords, container: null };
        }
    }

    static getLinkedSupplyContainer(player: Player): Container | null {
        return this.getSupplyChestStatus(player).container;
    }

    static findAvailableTorchItem(player: Player, isCreative: boolean): string | null {
        const inv = this.getPlayerInventory(player);
        if (isCreative) {
            if (inv?.container) {
                for (let i = 0; i < inv.container.size; i++) {
                    const item = inv.container.getItem(i);
                    if (item && this.TORCH_CANDIDATES.includes(item.typeId)) {
                        return item.typeId;
                    }
                }
            }
            return "minecraft:torch";
        }
        for (const candidate of this.TORCH_CANDIDATES) {
            if (this.countItemsInInventory(player, candidate) > 0) {
                return candidate;
            }
        }
        return null;
    }

    static getSurvivalDropType(blockType: string): string | null {
        if (!blockType || blockType.startsWith("arc_st:holo") || NON_DROPPABLE_BLOCKS.has(blockType)) {
            return null;
        }
        return ORE_DROP_MAP[blockType] ?? blockType;
    }

    static getStaffDurabilityInfo(item: ItemStack): { remaining: number; max: number } | null {
        if (StaffConfig.isUnbreakable(item.typeId)) return null;
        try {
            const durability = item.getComponent(ItemComponentTypes.Durability);
            if (!durability) return null;
            return {
                remaining: Math.max(0, durability.maxDurability - durability.damage),
                max: durability.maxDurability
            };
        } catch {
            return null;
        }
    }

    static countDirectItems(player: Player, itemType: string): number {
        let count = 0;
        const inventory = this.getPlayerInventory(player);
        if (inventory?.container) {
            const container = inventory.container;
            for (let i = 0; i < container.size; i++) {
                const item = container.getItem(i);
                if (item?.typeId === itemType) count += item.amount;
            }
        }
        const supply = this.getLinkedSupplyContainer(player);
        if (supply) {
            for (let i = 0; i < supply.size; i++) {
                const item = supply.getItem(i);
                if (item?.typeId === itemType) count += item.amount;
            }
        }
        return count;
    }

    static removeDirectItems(player: Player, itemType: string, count: number): number {
        if (count <= 0) return 0;
        let remaining = count;
        const inventory = this.getPlayerInventory(player);
        if (inventory?.container) {
            const container = inventory.container;
            for (let i = 0; i < container.size && remaining > 0; i++) {
                const item = container.getItem(i);
                if (item?.typeId === itemType) {
                    const toRemove = Math.min(item.amount, remaining);
                    remaining -= toRemove;
                    if (item.amount === toRemove) {
                        container.setItem(i, undefined);
                    } else {
                        item.amount -= toRemove;
                        container.setItem(i, item);
                    }
                }
            }
        }
        if (remaining > 0) {
            const supply = this.getLinkedSupplyContainer(player);
            if (supply) {
                for (let i = 0; i < supply.size && remaining > 0; i++) {
                    const item = supply.getItem(i);
                    if (item?.typeId === itemType) {
                        const toRemove = Math.min(item.amount, remaining);
                        remaining -= toRemove;
                        if (item.amount === toRemove) {
                            supply.setItem(i, undefined);
                        } else {
                            item.amount -= toRemove;
                            supply.setItem(i, item);
                        }
                    }
                }
            }
        }
        return count - remaining;
    }

    static getAutoCraftSources(itemType: string): Array<{ ingredient: string; inCount: number; outCount: number }> {
        const id = itemType.replace("minecraft:", "");
        const sources: Array<{ ingredient: string; inCount: number; outCount: number }> = [];

        if (id.endsWith("_planks")) {
            const wood = id.slice(0, -"_planks".length);
            if (wood === "crimson" || wood === "warped") {
                sources.push({ ingredient: `minecraft:${wood}_stem`, inCount: 1, outCount: 4 });
                sources.push({ ingredient: `minecraft:stripped_${wood}_stem`, inCount: 1, outCount: 4 });
            } else {
                sources.push({ ingredient: `minecraft:${wood}_log`, inCount: 1, outCount: 4 });
                sources.push({ ingredient: `minecraft:stripped_${wood}_log`, inCount: 1, outCount: 4 });
            }
            return sources;
        }

        const directMap: Record<string, string[]> = {
            "stone_bricks": ["minecraft:stone"],
            "stonebrick": ["minecraft:stone"],
            "polished_andesite": ["minecraft:andesite"],
            "polished_diorite": ["minecraft:diorite"],
            "polished_granite": ["minecraft:granite"],
            "polished_deepslate": ["minecraft:cobbled_deepslate", "minecraft:deepslate"],
            "deepslate_bricks": ["minecraft:polished_deepslate", "minecraft:cobbled_deepslate"],
            "deepslate_tiles": ["minecraft:deepslate_bricks", "minecraft:cobbled_deepslate"],
            "polished_blackstone": ["minecraft:blackstone"],
            "polished_blackstone_bricks": ["minecraft:polished_blackstone", "minecraft:blackstone"],
            "polished_tuff": ["minecraft:tuff"],
            "tuff_bricks": ["minecraft:polished_tuff", "minecraft:tuff"],
            "cut_sandstone": ["minecraft:sandstone"],
            "cut_red_sandstone": ["minecraft:red_sandstone"],
            "mud_bricks": ["minecraft:packed_mud"],
            "end_stone_bricks": ["minecraft:end_stone"],
            "quartz_bricks": ["minecraft:quartz_block"],
            "quartz_pillar": ["minecraft:quartz_block"]
        };
        if (id in directMap) {
            for (const ing of directMap[id]) {
                sources.push({ ingredient: ing, inCount: 1, outCount: 1 });
            }
            return sources;
        }

        const resolveBaseBlocks = (prefix: string): string[] => {
            const woodTypes = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "crimson", "warped", "bamboo"];
            if (woodTypes.includes(prefix)) return [`minecraft:${prefix}_planks`];
            if (prefix === "stone_brick") return ["minecraft:stone_bricks", "minecraft:stone"];
            if (prefix === "mossy_stone_brick") return ["minecraft:mossy_stone_bricks"];
            if (prefix === "deepslate_brick") return ["minecraft:deepslate_bricks", "minecraft:cobbled_deepslate"];
            if (prefix === "deepslate_tile") return ["minecraft:deepslate_tiles", "minecraft:cobbled_deepslate"];
            if (prefix === "polished_blackstone_brick") return ["minecraft:polished_blackstone_bricks", "minecraft:blackstone"];
            if (prefix === "tuff_brick") return ["minecraft:tuff_bricks", "minecraft:tuff"];
            if (prefix === "mud_brick") return ["minecraft:mud_bricks"];
            if (prefix === "end_stone_brick") return ["minecraft:end_stone_bricks", "minecraft:end_stone"];
            if (prefix === "brick") return ["minecraft:brick_block"];
            if (prefix === "nether_brick") return ["minecraft:nether_brick"];
            if (prefix === "quartz") return ["minecraft:quartz_block"];
            return [`minecraft:${prefix}`];
        };

        if (id.endsWith("_slab") && !id.includes("double")) {
            const prefix = id.slice(0, -"_slab".length);
            for (const base of resolveBaseBlocks(prefix)) {
                sources.push({ ingredient: base, inCount: 1, outCount: 2 });
            }
        } else if (id.endsWith("_stairs")) {
            const prefix = id.slice(0, -"_stairs".length);
            for (const base of resolveBaseBlocks(prefix)) {
                sources.push({ ingredient: base, inCount: 1, outCount: 1 });
            }
        } else if (id.endsWith("_wall")) {
            const prefix = id.slice(0, -"_wall".length);
            for (const base of resolveBaseBlocks(prefix)) {
                sources.push({ ingredient: base, inCount: 1, outCount: 1 });
            }
        }
        return sources;
    }

    static countItemsInInventory(player: Player, itemType: string): number {
        let count = this.countDirectItems(player, itemType);
        if (PlayerPatternSettings.isAutoCraftBlocks(player.name)) {
            for (const src of this.getAutoCraftSources(itemType)) {
                const rawAvail = this.countDirectItems(player, src.ingredient);
                if (rawAvail >= src.inCount) {
                    count += Math.floor(rawAvail / src.inCount) * src.outCount;
                }
            }
        }
        return count;
    }

    static removeItemsFromInventory(player: Player, itemType: string, count: number): number {
        if (count <= 0) return 0;
        let removed = this.removeDirectItems(player, itemType, count);
        let remaining = count - removed;

        if (remaining > 0 && PlayerPatternSettings.isAutoCraftBlocks(player.name)) {
            for (const src of this.getAutoCraftSources(itemType)) {
                if (remaining <= 0) break;
                const rawAvail = this.countDirectItems(player, src.ingredient);
                if (rawAvail < src.inCount) continue;

                const batchesNeeded = Math.ceil(remaining / src.outCount);
                const maxBatches = Math.floor(rawAvail / src.inCount);
                const batchesToCraft = Math.min(batchesNeeded, maxBatches);
                if (batchesToCraft <= 0) continue;

                const consumedRaw = this.removeDirectItems(player, src.ingredient, batchesToCraft * src.inCount);
                const actualBatches = Math.floor(consumedRaw / src.inCount);
                const produced = actualBatches * src.outCount;
                const usedFromCraft = Math.min(remaining, produced);
                const surplus = produced - usedFromCraft;

                remaining -= usedFromCraft;
                removed += usedFromCraft;
                if (surplus > 0) {
                    this.giveItemsOrDrop(player, itemType, surplus);
                }
            }
        }
        return removed;
    }

    static giveItemsOrDrop(player: Player, itemType: string, count: number): void {
        if (count <= 0) return;
        const inventory = this.getPlayerInventory(player);
        const supply = this.getLinkedSupplyContainer(player);
        let remaining = count;
        while (remaining > 0) {
            try {
                const probe = new ItemStack(itemType, 1);
                const batchSize = Math.min(remaining, probe.maxAmount || 64);
                let stack: ItemStack | undefined = new ItemStack(itemType, batchSize);
                remaining -= batchSize;

                if (supply && stack) {
                    stack = supply.addItem(stack);
                }
                if (stack && inventory?.container) {
                    stack = inventory.container.addItem(stack);
                }
                if (stack) {
                    player.dimension.spawnItem(stack, player.location);
                }
            } catch {
                break;
            }
        }
    }

    static syncHeldStaffAppearance(player: Player, mode: string): ItemStack | undefined {
        const inventory = this.getPlayerInventory(player);
        if (!inventory?.container) return undefined;
        const slot = player.selectedSlotIndex;
        const current = inventory.container.getItem(slot);
        if (!current || !StaffConfig.isStaff(current.typeId)) return current;

        const targetId = mode === "destruction"
            ? StaffConfig.getDestructionStaffId(current.typeId)
            : StaffConfig.getBaseStaffId(current.typeId);

        if (current.typeId === targetId) return current;

        try {
            const swapped = new ItemStack(targetId, 1);
            if (current.nameTag) swapped.nameTag = current.nameTag;
            const lore = current.getLore();
            if (lore.length > 0) swapped.setLore(lore);

            const oldDurability = current.getComponent(ItemComponentTypes.Durability);
            const newDurability = swapped.getComponent(ItemComponentTypes.Durability);
            if (oldDurability && newDurability) {
                newDurability.damage = Math.min(oldDurability.damage, newDurability.maxDurability);
            }

            const oldEnchant = current.getComponent(ItemComponentTypes.Enchantable);
            const newEnchant = swapped.getComponent(ItemComponentTypes.Enchantable);
            if (oldEnchant && newEnchant) {
                const enchantments = oldEnchant.getEnchantments();
                if (enchantments.length > 0) {
                    newEnchant.addEnchantments(enchantments);
                }
            }

            inventory.container.setItem(slot, swapped);
            return swapped;
        } catch {
            return current;
        }
    }

    static reduceDurability(item: ItemStack, damage: number, player: Player, contextMode = "construction"): boolean {
        if (player.getGameMode() === GameMode.creative || damage <= 0) return false;
        try {
            const inventory = this.getPlayerInventory(player);
            if (!inventory?.container) return false;

            const currentHeld = inventory.container.getItem(player.selectedSlotIndex);
            const targetItem = (currentHeld && StaffConfig.isStaff(currentHeld.typeId)) ? currentHeld : item;
            const baseId = StaffConfig.getBaseStaffId(targetItem.typeId);

            if (StaffConfig.isUnbreakable(baseId)) return false;
            if (baseId === "arc_st:prismarine_staff" && player.isInWater) return false;
            if (baseId === "arc_st:emerald_staff" && contextMode === "replace") return false;
            if (baseId === "arc_st:copper_staff" && Math.random() < 0.2) return false;

            const durability = targetItem.getComponent(ItemComponentTypes.Durability);
            if (!durability) return false;

            const enchantable = targetItem.getComponent(ItemComponentTypes.Enchantable);
            if (enchantable) {
                const unbreaking = enchantable.getEnchantments().find(e => e.type.id === "unbreaking" || e.type.id === "minecraft:unbreaking");
                if (unbreaking && unbreaking.level > 0) {
                    let effectiveDamage = 0;
                    for (let i = 0; i < damage; i++) {
                        if (Math.random() < 1 / (unbreaking.level + 1)) {
                            effectiveDamage++;
                        }
                    }
                    if (effectiveDamage === 0) return false;
                    damage = effectiveDamage;
                }
            }

            const newDamage = durability.damage + damage;
            if (newDamage >= durability.maxDurability) {
                inventory.container.setItem(player.selectedSlotIndex, undefined);
                player.playSound("random.break", { pitch: 0.9, volume: 1.0 });
                MessageUtils.sendErrorMessage(player, "Seu cetro se rompeu!");
                return true;
            }

            durability.damage = newDamage;
            inventory.container.setItem(player.selectedSlotIndex, targetItem);

            const remaining = durability.maxDurability - newDamage;
            if (remaining <= 5 && remaining > 0) {
                MessageUtils.sendMessage(player, `§eAtenção: seu cetro tem apenas §c${remaining} §eusos restantes!`);
                player.playSound("random.anvil_land", { pitch: 1.8, volume: 0.35 });
            }
            return true;
        } catch (error) {
            console.warn(`Failed to reduce staff durability: ${error}`);
            return false;
        }
    }

    static getHeldItem(player: Player): ItemStack | undefined {
        const inventory = this.getPlayerInventory(player);
        return inventory?.container?.getItem(player.selectedSlotIndex);
    }

    static hasEnoughItems(player: Player, itemType: string, requiredAmount: number): boolean {
        return this.countItemsInInventory(player, itemType) >= requiredAmount;
    }
}
