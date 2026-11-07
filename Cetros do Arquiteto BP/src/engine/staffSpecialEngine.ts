import { BlockPermutation, GameMode, ItemComponentTypes, ItemStack, Player, Vector3 } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { StaffConfig, StaffSpecialAbility } from "../config/staffConfig";
import { BlockSelectionManager } from "../api/models/blockSelection";
import { PlayerPatternSettings } from "../api/models/playerPatternSettings";
import { InventoryUtils } from "../api/inventoryUtils";
import { BlockUtils } from "../api/blockUtils";
import { VectorUtils } from "../api/vectorUtils";
import { MessageUtils } from "../api/messageUtils";
import { PlayerUtils } from "../api/playerUtils";
import { UndoEngine, UndoEntry } from "./undoEngine";
import { ReplaceEngine } from "./replaceEngine";
import { HoloPreviewEngine } from "./holoEngine";

export class StaffSpecialEngine {
    static getSpecialButtonLabel(ability: StaffSpecialAbility): string {
        switch (ability) {
            case "echo_angel": return "§bHabilidade: Bloco no Ar (Angel Block)";
            case "prismarine_drain": return "§3Habilidade: Drenar Água/Lava";
            case "copper_oxidize": return "§6Habilidade: Oxidar / Raspar Cobre";
            case "quartz_light": return "§eHabilidade: Farol Solar (Iluminar Área)";
            case "redstone_wrench": return "§cHabilidade: Girar Bloco Mirado";
            case "amethyst_telescope": return "§dHabilidade: Medir Distância (100m)";
            case "emerald_master": return "§aHabilidade: Inverter Substituição";
            case "obsidian_solidify": return "§5Habilidade: Cristalizar Lava / Água";
            case "breeze_leap": return "§bHabilidade: Impulso Eólico & Planador";
            case "end_blink": return "§dHabilidade: Salto Dimensional (100m)";
        }
    }

    static async executeSpecialAbility(player: Player, staff: ItemStack, ability: StaffSpecialAbility): Promise<void> {
        HoloPreviewEngine.clearAllPreviews(player);
        switch (ability) {
            case "echo_angel":
                this.placeAngelBlock(player);
                break;
            case "prismarine_drain":
                this.drainLiquids(player, staff);
                break;
            case "copper_oxidize":
                await this.openCopperSubmenu(player, staff);
                break;
            case "quartz_light":
                this.placeSolarLightPulse(player, staff);
                break;
            case "redstone_wrench":
                this.rotateTargetBlock(player, staff);
                break;
            case "amethyst_telescope":
                this.measureDistance(player);
                break;
            case "emerald_master":
                this.swapReplaceBlocks(player);
                break;
            case "obsidian_solidify":
                this.solidifyLiquids(player, staff);
                break;
            case "breeze_leap":
                this.executeWindLeap(player, staff);
                break;
            case "end_blink":
                this.executeEndBlink(player, staff);
                break;
        }
    }

    static placeAngelBlock(player: Player): void {
        const isCreative = player.getGameMode() === GameMode.creative;
        const isRandomizer = PlayerPatternSettings.isRandomizerActive(player.name);
        let blockType = "";
        let permutation: BlockPermutation | null = null;

        if (isRandomizer) {
            const palette = PlayerPatternSettings.getPalette(player.name, 9);
            const available = isCreative
                ? palette
                : palette.filter(bt => InventoryUtils.countItemsInInventory(player, bt) > 0);
            if (available.length === 0) {
                MessageUtils.sendErrorMessage(player, "Selecione um bloco ou preencha a paleta primeiro.");
                player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                return;
            }
            blockType = available[Math.floor(Math.random() * available.length)];
            permutation = BlockPermutation.resolve(blockType);
        } else {
            const selected = BlockSelectionManager.getSelection(player.name);
            if (!selected) {
                MessageUtils.sendErrorMessage(player, "Selecione um bloco primeiro para colocá-lo no ar!");
                player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                return;
            }
            blockType = selected.blockType;
            permutation = selected.permutation;
            if (!isCreative && InventoryUtils.countItemsInInventory(player, blockType) <= 0) {
                MessageUtils.sendErrorMessage(player, `Você não tem ${BlockUtils.getReadableBlockName(blockType)} no inventário.`);
                player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                return;
            }
        }

        const head = player.getHeadLocation();
        const dir = VectorUtils.normalize(player.getViewDirection());
        const targetPos: Vector3 = {
            x: Math.floor(head.x + dir.x * 4),
            y: Math.floor(head.y + dir.y * 4),
            z: Math.floor(head.z + dir.z * 4)
        };

        try {
            const targetBlock = player.dimension.getBlock(targetPos);
            if (!targetBlock || (targetBlock.typeId !== "minecraft:air" && !targetBlock.isLiquid)) {
                MessageUtils.sendErrorMessage(player, "O espaço 4 blocos à frente não está livre.");
                player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                return;
            }
            const oldPerm = targetBlock.permutation;
            targetBlock.setPermutation(permutation!);
            if (!isCreative) {
                InventoryUtils.removeItemsFromInventory(player, blockType, 1);
            }
            UndoEngine.recordOperation(player, [
                UndoEngine.createEntry(player, targetPos, oldPerm, permutation!, !isCreative ? blockType : undefined)
            ]);
            PlayerUtils.updatePlayerHotbarMessage(player);
            MessageUtils.sendSuccessMessage(
                player,
                `Bloco flutuante colocado em [${targetPos.x}, ${targetPos.y}, ${targetPos.z}]!`
            );
            player.playSound("chime.amethyst_block", { pitch: 1.3, volume: 1.0 });
        } catch {
            MessageUtils.sendErrorMessage(player, "Não foi possível colocar o bloco nessa altura.");
        }
    }

    static drainLiquids(player: Player, staff: ItemStack): void {
        const view = player.getBlockFromViewDirection({
            maxDistance: 64,
            includeLiquidBlocks: true,
            includePassableBlocks: false
        });
        const center = view?.block ? view.block.location : VectorUtils.floor(player.location);
        const radius = 6;
        const airPerm = BlockPermutation.resolve("minecraft:air");
        const entries: UndoEntry[] = [];

        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    if (x * x + y * y + z * z > radius * radius) continue;
                    const pos = {
                        x: Math.floor(center.x + x),
                        y: Math.floor(center.y + y),
                        z: Math.floor(center.z + z)
                    };
                    try {
                        const block = player.dimension.getBlock(pos);
                        if (!block) continue;
                        const isLiq = block.isLiquid ||
                            block.typeId === "minecraft:water" ||
                            block.typeId === "minecraft:flowing_water" ||
                            block.typeId === "minecraft:lava" ||
                            block.typeId === "minecraft:flowing_lava";
                        if (isLiq) {
                            const oldPerm = block.permutation;
                            block.setPermutation(airPerm);
                            entries.push(UndoEngine.createEntry(player, pos, oldPerm, airPerm));
                        }
                    } catch { }
                }
            }
        }

        if (entries.length === 0) {
            MessageUtils.sendErrorMessage(player, "Nenhum líquido (água ou lava) encontrado próximo.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }

        UndoEngine.recordOperation(player, entries);
        InventoryUtils.reduceDurability(staff, 1, player, "special");
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendSuccessMessage(player, `${entries.length} blocos de líquido drenados!`);
        player.playSound("random.fizz", { pitch: 1.2, volume: 0.8 });
    }

    static async openCopperSubmenu(player: Player, staff: ItemStack): Promise<void> {
        const form = new ActionFormData()
            .title("§l§6FORJA DO COBRE")
            .body("§8Transforma todos os blocos, lajes e escadas de cobre num raio de 5 blocos ao redor do ponto mirado:")
            .button("§2Envelhecer / Oxidar Cobre (+1 nível)", "textures/igorcosta/architect_staffs/ui/mode_build")
            .button("§6Raspar / Limpar Cobre (-1 nível)", "textures/igorcosta/architect_staffs/ui/mode_swap")
            .button("§8Cancelar", "textures/igorcosta/architect_staffs/ui/act_back");

        const res = await form.show(player);
        if (res.canceled || res.selection === undefined || res.selection === 2) return;
        const action = res.selection === 0 ? "oxidize" : "scrape";

        const center = VectorUtils.getRaycastCenter(player, 64);
        const radius = 5;
        const entries: UndoEntry[] = [];

        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    if (x * x + y * y + z * z > radius * radius) continue;
                    const pos = {
                        x: Math.floor(center.x + x),
                        y: Math.floor(center.y + y),
                        z: Math.floor(center.z + z)
                    };
                    try {
                        const block = player.dimension.getBlock(pos);
                        if (!block) continue;
                        const nextType = BlockUtils.transformCopperBlock(block.typeId, action);
                        if (!nextType) continue;
                        const oldPerm = block.permutation;
                        const newPerm = ReplaceEngine.resolveCompatiblePermutation(oldPerm, nextType);
                        block.setPermutation(newPerm);
                        entries.push(UndoEngine.createEntry(player, pos, oldPerm, newPerm));
                    } catch { }
                }
            }
        }

        if (entries.length === 0) {
            MessageUtils.sendErrorMessage(player, "Nenhum bloco de cobre transformável encontrado no local mirado.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }

        UndoEngine.recordOperation(player, entries);
        InventoryUtils.reduceDurability(staff, 1, player, "special");
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendSuccessMessage(
            player,
            `${entries.length} blocos de cobre ${action === "oxidize" ? "oxidados" : "raspados"}!`
        );
        player.playSound("use.copper", { pitch: action === "oxidize" ? 0.8 : 1.3, volume: 1.0 });
    }

    static rotateTargetBlock(player: Player, staff: ItemStack): void {
        const view = player.getBlockFromViewDirection({
            maxDistance: StaffConfig.getViewDistance(staff.typeId),
            includeLiquidBlocks: false,
            includePassableBlocks: false
        });
        if (!view?.block || view.block.typeId === "minecraft:air") {
            MessageUtils.sendErrorMessage(player, "Olhe para uma escada, laje, tronco ou bloco direcional para girar.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        const block = view.block;
        const oldPerm = block.permutation;
        if (!BlockUtils.cycleBlockOrientation(block)) {
            MessageUtils.sendErrorMessage(player, "Este bloco não possui estados de rotação compatíveis.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        const newPerm = block.permutation;
        UndoEngine.recordOperation(player, [
            UndoEngine.createEntry(player, block.location, oldPerm, newPerm)
        ]);
        InventoryUtils.reduceDurability(staff, 1, player, "special");
        MessageUtils.sendSuccessMessage(player, `Orientação de ${BlockUtils.getReadableBlockName(block.typeId)} ajustada!`);
        player.playSound("random.click", { pitch: 1.3, volume: 0.9 });
    }

    static measureDistance(player: Player): void {
        const view = player.getBlockFromViewDirection({
            maxDistance: 100,
            includeLiquidBlocks: true,
            includePassableBlocks: false
        });
        if (!view?.block) {
            MessageUtils.sendErrorMessage(player, "Nenhum bloco encontrado em até 100 blocos de distância.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        const loc = view.block.location;
        const dist = Math.round(VectorUtils.distance(player.location, loc) * 10) / 10;
        const dx = Math.abs(Math.floor(player.location.x) - loc.x);
        const dy = Math.abs(Math.floor(player.location.y) - loc.y);
        const dz = Math.abs(Math.floor(player.location.z) - loc.z);
        MessageUtils.sendMessage(
            player,
            `§dAlvo: §f${BlockUtils.getReadableBlockName(view.block.typeId)} §8| §bDistância: §f${dist}m §8| §eXYZ: §f[${loc.x}, ${loc.y}, ${loc.z}] §7(Δ ${dx}x ${dy}y ${dz}z)`
        );
        try {
            player.dimension.spawnParticle("minecraft:villager_happy", { x: loc.x + 0.5, y: loc.y + 1.1, z: loc.z + 0.5 });
        } catch { }
        player.playSound("chime.amethyst_block", { pitch: 1.2, volume: 1.0 });
    }

    static swapReplaceBlocks(player: Player): void {
        const settings = PlayerPatternSettings.getReplaceSettings(player.name);
        if (!settings.findBlock || !settings.replaceBlock) {
            MessageUtils.sendErrorMessage(player, "Selecione os dois blocos do Modo Substituição primeiro.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        PlayerPatternSettings.setReplaceSettings(player.name, {
            findBlock: settings.replaceBlock,
            replaceBlock: settings.findBlock
        });
        PlayerPatternSettings.setMode(player.name, "replace");
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendSuccessMessage(
            player,
            `Invertido! Alvo: ${BlockUtils.getReadableBlockName(settings.replaceBlock)} -> Novo: ${BlockUtils.getReadableBlockName(settings.findBlock)}`
        );
        player.playSound("random.orb", { pitch: 1.3, volume: 1.0 });
    }

    static placeSolarLightPulse(player: Player, staff: ItemStack): void {
        const isCreative = player.getGameMode() === GameMode.creative;
        const lightSource = isCreative
            ? "minecraft:torch"
            : InventoryUtils.findLightSource(player);
        if (!lightSource) {
            MessageUtils.sendErrorMessage(player, "Tenha Tochas ou Lanternas no inventário ou no Baú de Suprimentos para usar o Farol Solar!");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }

        const center = VectorUtils.getRaycastCenter(player, 48);
        const radius = 9;
        const step = 4;
        const lightPerm = BlockPermutation.resolve(lightSource);
        const entries: UndoEntry[] = [];

        for (let dx = -radius; dx <= radius; dx += step) {
            for (let dz = -radius; dz <= radius; dz += step) {
                for (let dy = 3; dy >= -3; dy--) {
                    const floorPos = {
                        x: Math.floor(center.x + dx),
                        y: Math.floor(center.y + dy),
                        z: Math.floor(center.z + dz)
                    };
                    const abovePos = { x: floorPos.x, y: floorPos.y + 1, z: floorPos.z };
                    try {
                        const floorBlk = player.dimension.getBlock(floorPos);
                        const aboveBlk = player.dimension.getBlock(abovePos);
                        if (!floorBlk || !aboveBlk) continue;
                        if (floorBlk.typeId === "minecraft:air" || floorBlk.isLiquid) continue;
                        if (aboveBlk.typeId !== "minecraft:air") continue;

                        if (!isCreative && !InventoryUtils.removeItemsFromInventory(player, lightSource, 1)) {
                            break;
                        }
                        const oldPerm = aboveBlk.permutation;
                        aboveBlk.setPermutation(lightPerm);
                        entries.push(
                            UndoEngine.createEntry(player, abovePos, oldPerm, lightPerm, !isCreative ? lightSource : undefined)
                        );
                        break;
                    } catch { }
                }
            }
        }

        if (entries.length === 0) {
            MessageUtils.sendErrorMessage(player, "Nenhum ponto livre encontrado para iluminar na área.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }

        UndoEngine.recordOperation(player, entries);
        PlayerPatternSettings.recordStats(player, "built", entries.length);
        InventoryUtils.reduceDurability(staff, 1, player, "special");
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendSuccessMessage(player, `Farol Solar posicionou ${entries.length}x ${BlockUtils.getReadableBlockName(lightSource)}!`);
        player.playSound("block.beacon.activate", { pitch: 1.4, volume: 0.8 });
    }

    static solidifyLiquids(player: Player, staff: ItemStack): void {
        const view = player.getBlockFromViewDirection({
            maxDistance: 64,
            includeLiquidBlocks: true,
            includePassableBlocks: false
        });
        const center = view?.block ? view.block.location : VectorUtils.floor(player.location);
        const radius = 7;
        const obsPerm = BlockPermutation.resolve("minecraft:obsidian");
        const stonePerm = BlockPermutation.resolve("minecraft:stone");
        const entries: UndoEntry[] = [];

        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    if (x * x + y * y + z * z > radius * radius) continue;
                    const pos = {
                        x: Math.floor(center.x + x),
                        y: Math.floor(center.y + y),
                        z: Math.floor(center.z + z)
                    };
                    try {
                        const block = player.dimension.getBlock(pos);
                        if (!block) continue;
                        if (block.typeId === "minecraft:lava" || block.typeId === "minecraft:flowing_lava") {
                            const oldPerm = block.permutation;
                            block.setPermutation(obsPerm);
                            entries.push(UndoEngine.createEntry(player, pos, oldPerm, obsPerm));
                        } else if (block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water") {
                            const oldPerm = block.permutation;
                            block.setPermutation(stonePerm);
                            entries.push(UndoEngine.createEntry(player, pos, oldPerm, stonePerm));
                        }
                    } catch { }
                }
            }
        }

        if (entries.length === 0) {
            MessageUtils.sendErrorMessage(player, "Nenhuma lava ou água encontrada num raio de 7 blocos para cristalizar.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }

        UndoEngine.recordOperation(player, entries);
        PlayerPatternSettings.recordStats(player, "replaced", entries.length);
        InventoryUtils.reduceDurability(staff, 2, player, "special");
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendSuccessMessage(player, `${entries.length} blocos de lava/água cristalizados em rocha sólida!`);
        player.playSound("random.fizz", { pitch: 0.9, volume: 1.0 });
    }

    static executeWindLeap(player: Player, staff: ItemStack): void {
        try {
            const dir = VectorUtils.normalize(player.getViewDirection());
            player.applyKnockback(dir.x, dir.z, 1.8, 1.15);
            player.addEffect("slow_falling", 300, { amplifier: 0, showParticles: true });
            InventoryUtils.reduceDurability(staff, 1, player, "special");
            MessageUtils.sendSuccessMessage(player, "Impulso Eólico ativado! Planando com Queda Lenta por 15s.");
            player.playSound("mob.breeze.shoot", { pitch: 1.1, volume: 1.0 });
        } catch {
            MessageUtils.sendErrorMessage(player, "Não foi possível ativar o Impulso Eólico neste local.");
        }
    }

    static executeEndBlink(player: Player, staff: ItemStack): void {
        const view = player.getBlockFromViewDirection({
            maxDistance: 100,
            includeLiquidBlocks: false,
            includePassableBlocks: false
        });
        if (!view?.block) {
            MessageUtils.sendErrorMessage(player, "Aponte para um bloco em até 100m para realizar o Salto Dimensional!");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        const loc = view.block.location;
        const dest: Vector3 = { x: loc.x + 0.5, y: loc.y + 1.05, z: loc.z + 0.5 };
        try {
            player.teleport(dest, { dimension: player.dimension });
            InventoryUtils.reduceDurability(staff, 2, player, "special");
            MessageUtils.sendSuccessMessage(player, `Salto Dimensional concluído para [${loc.x}, ${loc.y + 1}, ${loc.z}]!`);
            player.playSound("mob.endermen.portal", { pitch: 1.1, volume: 1.0 });
        } catch {
            MessageUtils.sendErrorMessage(player, "Destino obstruído para o Salto Dimensional.");
        }
    }

    static executeItemMagnet(player: Player, radius = 25): number {
        try {
            const items = player.dimension.getEntities({
                type: "minecraft:item",
                location: player.location,
                maxDistance: radius
            });
            let count = 0;
            for (const ent of items) {
                try {
                    ent.teleport(player.location, { dimension: player.dimension });
                    count++;
                } catch { }
            }
            if (count > 0) {
                MessageUtils.sendSuccessMessage(player, `Ímã do Arquiteto atraiu ${count} pilha(s) de itens num raio de ${radius}m!`);
                player.playSound("random.orb", { pitch: 1.35, volume: 0.9 });
            } else {
                MessageUtils.sendMessage(player, `§7Nenhum item solto no chão num raio de ${radius}m.`);
                player.playSound("random.click", { pitch: 1.0, volume: 0.7 });
            }
            return count;
        } catch {
            return 0;
        }
    }

    static executeXpRepair(player: Player): boolean {
        const inv = InventoryUtils.getPlayerInventory(player);
        if (!inv?.container) return false;
        const held = inv.container.getItem(player.selectedSlotIndex);
        if (!held || !StaffConfig.isStaff(held.typeId)) {
            MessageUtils.sendErrorMessage(player, "Segure um Cetro na mão principal para reparar.");
            return false;
        }
        if (StaffConfig.isUnbreakable(held.typeId)) {
            MessageUtils.sendMessage(player, "§bO Cetro Eco Astral já é inquebrável (∞)!");
            return false;
        }
        const dur = held.getComponent(ItemComponentTypes.Durability);
        if (!dur || dur.damage <= 0) {
            MessageUtils.sendMessage(player, "§aSeu Cetro já está com 100% da durabilidade intacta!");
            player.playSound("random.orb", { pitch: 1.2, volume: 0.8 });
            return false;
        }
        const isCreative = player.getGameMode() === GameMode.creative;
        const curLevels = player.level;
        if (!isCreative && curLevels <= 0) {
            MessageUtils.sendErrorMessage(player, "Você precisa de pelo menos 1 Nível de XP para reparar o Cetro!");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return false;
        }
        const repairPerLevel = 250;
        const neededLevels = Math.max(1, Math.ceil(dur.damage / repairPerLevel));
        const usedLevels = isCreative ? neededLevels : Math.min(curLevels, neededLevels);
        const restored = Math.min(dur.damage, usedLevels * repairPerLevel);

        dur.damage = Math.max(0, dur.damage - restored);
        inv.container.setItem(player.selectedSlotIndex, held);
        if (!isCreative) {
            player.addLevels(-usedLevels);
        }
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendSuccessMessage(
            player,
            `Cetro reparado em +${restored} pts de durabilidade (gastou ${isCreative ? 0 : usedLevels} nível(is) de XP)!`
        );
        player.playSound("random.anvil_use", { pitch: 1.15, volume: 0.9 });
        return true;
    }
}
