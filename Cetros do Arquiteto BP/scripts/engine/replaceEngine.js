import { BlockPermutation, GameMode } from "@minecraft/server";
import { BlockUtils } from "../api/blockUtils";
import { InventoryUtils } from "../api/inventoryUtils";
import { PlayerUtils } from "../api/playerUtils";
import { StaffConfig } from "../config/staffConfig";
import { PatternEngine } from "./patternEngine";
import { PlayerPatternSettings } from "../api/models/playerPatternSettings";
import { MessageUtils } from "../api/messageUtils";
import { StaffEngine } from "./staffEngine";
import { UndoEngine } from "./undoEngine";
import { RegionEngine } from "./regionEngine";
export class ReplaceEngine {
    static handleReplaceSelection(player, targetBlock) {
        const settings = PlayerPatternSettings.getReplaceSettings(player.name);
        const isCreative = player.getGameMode() === GameMode.creative;
        if (BlockUtils.hasContainerOrComplexData(targetBlock)) {
            MessageUtils.sendErrorMessage(player, "Não é possível selecionar baús ou blocos compostos.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        if (!isCreative && StaffEngine.isBlockUndestroyable(targetBlock.typeId)) {
            MessageUtils.sendErrorMessage(player, `Não é possível selecionar ${BlockUtils.getReadableBlockName(targetBlock.typeId)} no modo Sobrevivência.`);
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        if (!settings.findBlock) {
            PlayerPatternSettings.setReplaceSettings(player.name, { findBlock: targetBlock.typeId });
            PlayerUtils.updatePlayerHotbarMessage(player);
            MessageUtils.sendReplaceMessage(player, "find", targetBlock.typeId);
            this.spawnSelectionParticles(player, targetBlock.location, "yellow");
            player.playSound("random.orb", { pitch: 1.0, volume: 1.0 });
            return;
        }
        if (!settings.usePalette && !settings.weatheringMode && !settings.replaceBlock) {
            if (targetBlock.typeId === settings.findBlock) {
                MessageUtils.sendErrorMessage(player, "O bloco substituto deve ser diferente do bloco alvo.");
                player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                return;
            }
            PlayerPatternSettings.setReplaceSettings(player.name, { replaceBlock: targetBlock.typeId });
            PlayerUtils.updatePlayerHotbarMessage(player);
            MessageUtils.sendReplaceMessage(player, "replace", targetBlock.typeId);
            this.spawnSelectionParticles(player, targetBlock.location, "green");
            player.playSound("random.orb", { pitch: 1.2, volume: 1.0 });
            return;
        }
        const replaceMode = PlayerPatternSettings.getReplaceMode(player.name);
        if (replaceMode === "box2p") {
            const pos1 = RegionEngine.getPos1(player.name, player.dimension.id, "replace");
            if (!pos1) {
                const loc = targetBlock.location;
                RegionEngine.setPos1(player, loc, "replace");
                PlayerUtils.updatePlayerHotbarMessage(player);
                this.spawnSelectionParticles(player, loc, "yellow");
                MessageUtils.sendSuccessMessage(player, `Ponto 1 marcado em (${loc.x}, ${loc.y}, ${loc.z})! Aponte para o Ponto 2 para substituir.`);
                player.playSound("random.orb", { pitch: 1.2, volume: 1.0 });
                return;
            }
            this.executeReplacement(player, targetBlock);
            return;
        }
        if (targetBlock.typeId === settings.findBlock) {
            this.executeReplacement(player, targetBlock);
        }
        else {
            MessageUtils.sendErrorMessage(player, `Você precisa olhar para ${BlockUtils.getReadableBlockName(settings.findBlock)} para substituir.`);
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
        }
    }
    static executeReplacement(player, targetBlock, staff, frozenPositions) {
        const settings = PlayerPatternSettings.getReplaceSettings(player.name);
        const replaceMode = PlayerPatternSettings.getReplaceMode(player.name);
        const isCreative = player.getGameMode() === GameMode.creative;
        const heldStaff = staff ?? InventoryUtils.getHeldItem(player);
        const maxPal = heldStaff ? StaffConfig.getMaxPaletteSize(heldStaff.typeId) : 6;
        const palette = PlayerPatternSettings.getPalette(player.name, maxPal);
        const effectiveFind = settings.findBlock ?? (settings.weatheringMode && targetBlock ? targetBlock.typeId : null);
        if (!effectiveFind)
            return;
        if (!settings.usePalette && !settings.weatheringMode) {
            if (!settings.replaceBlock)
                return;
            if (effectiveFind === settings.replaceBlock) {
                MessageUtils.sendErrorMessage(player, "O bloco alvo e o substituto são iguais.");
                player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                return;
            }
        }
        if (!isCreative && StaffEngine.isBlockUndestroyable(effectiveFind)) {
            MessageUtils.sendErrorMessage(player, "Não é permitido usar blocos restritos no modo Sobrevivência.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        let candidateList = [];
        if (settings.weatheringMode) {
            candidateList = BlockUtils.getWeatheredVariants(effectiveFind);
            if (candidateList.length === 0) {
                MessageUtils.sendErrorMessage(player, `${BlockUtils.getReadableBlockName(effectiveFind)} não possui variantes musgosas ou rachadas.`);
                player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                return;
            }
        }
        else if (settings.usePalette) {
            candidateList = palette.filter(bt => bt !== effectiveFind);
            if (candidateList.length === 0) {
                MessageUtils.sendErrorMessage(player, "Adicione blocos diferentes do alvo na sua Paleta para usar o Pincel de Texturização!");
                player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                return;
            }
        }
        else if (settings.replaceBlock) {
            candidateList = [settings.replaceBlock];
        }
        if (!isCreative) {
            const totalAvail = candidateList.reduce((s, bt) => s + InventoryUtils.countItemsInInventory(player, bt), 0);
            if (totalAvail <= 0) {
                MessageUtils.sendErrorMessage(player, "Você não possui os blocos substitutos necessários no inventário ou no Baú de Suprimentos.");
                player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                return;
            }
        }
        let positions = [];
        if (frozenPositions && frozenPositions.length > 0) {
            positions = frozenPositions;
            RegionEngine.clearPos1(player.name);
        }
        else if (targetBlock) {
            if (replaceMode === "connected") {
                positions = this.findConnectedBlocks(player, targetBlock, effectiveFind);
            }
            else if (replaceMode === "box2p") {
                const pos1 = RegionEngine.getPos1(player.name, player.dimension.id, "replace");
                if (!pos1)
                    return;
                RegionEngine.clearPos1(player.name);
                const maxVol = heldStaff ? StaffConfig.getMaxBox2PVolume(heldStaff.typeId) : 400;
                const boxPositions = PatternEngine.calculateBox2P(pos1, targetBlock.location, "filled", maxVol);
                positions = boxPositions.filter(pos => {
                    try {
                        const b = player.dimension.getBlock(pos);
                        return b ? (b.typeId === effectiveFind && !BlockUtils.hasContainerOrComplexData(b)) : false;
                    }
                    catch {
                        return false;
                    }
                });
            }
            else {
                const maxArea = heldStaff ? StaffConfig.maxReplaceArea[heldStaff.typeId] || 5 : 5;
                const radius = Math.min(settings.areaSize, maxArea);
                positions = this.findAreaBlocks(player, targetBlock.location, effectiveFind, radius);
            }
        }
        if (positions.length === 0) {
            MessageUtils.sendErrorMessage(player, "Nenhum bloco encontrado para substituir.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        const entries = [];
        const consumedCounts = new Map();
        let soundCounter = 0;
        for (const pos of positions) {
            try {
                const block = player.dimension.getBlock(pos);
                if (!block || block.typeId !== effectiveFind || BlockUtils.hasContainerOrComplexData(block))
                    continue;
                if (!isCreative && StaffEngine.isBlockUndestroyable(block.typeId))
                    continue;
                if (settings.weatheringMode && Math.random() > 0.55) {
                    continue;
                }
                let availCandidates = candidateList;
                if (!isCreative) {
                    availCandidates = candidateList.filter(bt => InventoryUtils.countItemsInInventory(player, bt) > (consumedCounts.get(bt) ?? 0));
                    if (availCandidates.length === 0)
                        break;
                }
                const chosenBlock = settings.usePalette
                    ? PlayerPatternSettings.pickWeightedBlock(player.name, availCandidates)
                    : availCandidates[Math.floor(Math.random() * availCandidates.length)];
                if (chosenBlock === effectiveFind)
                    continue;
                const oldPermutation = block.permutation;
                const dropType = !isCreative ? InventoryUtils.getSurvivalDropType(block.typeId) : null;
                const newPermutation = this.resolveCompatiblePermutation(oldPermutation, chosenBlock);
                block.setPermutation(newPermutation);
                consumedCounts.set(chosenBlock, (consumedCounts.get(chosenBlock) ?? 0) + 1);
                entries.push(UndoEngine.createEntry(player, pos, oldPermutation, newPermutation, !isCreative ? chosenBlock : undefined, dropType ?? undefined));
                soundCounter++;
                if (soundCounter % 10 === 0) {
                    player.playSound("random.pop", { pitch: 0.9 + Math.random() * 0.4, volume: 0.3 });
                }
            }
            catch { }
        }
        const replaced = entries.length;
        if (replaced > 0) {
            if (!isCreative) {
                for (const [bt, cnt] of consumedCounts.entries()) {
                    InventoryUtils.removeItemsFromInventory(player, bt, cnt);
                }
                const dropType = InventoryUtils.getSurvivalDropType(effectiveFind);
                if (dropType) {
                    InventoryUtils.giveItemsOrDrop(player, dropType, replaced);
                }
                if (heldStaff && StaffConfig.isStaff(heldStaff.typeId)) {
                    InventoryUtils.reduceDurability(heldStaff, 1, player, "replace");
                }
            }
            UndoEngine.recordOperation(player, entries);
            PlayerPatternSettings.recordStats(player, "replaced", replaced);
            PlayerUtils.updatePlayerHotbarMessage(player);
            MessageUtils.sendSuccessMessage(player, `${replaced} blocos texturizados/substituídos!`);
            player.playSound("random.levelup", { pitch: 1.2, volume: 0.7 });
            const currentSettings = PlayerPatternSettings.getReplaceSettings(player.name);
            if (!currentSettings.keepSelections && !currentSettings.usePalette && !currentSettings.weatheringMode) {
                PlayerPatternSettings.clearReplaceBlocks(player.name);
                PlayerUtils.updatePlayerHotbarMessage(player);
            }
        }
    }
    static findConnectedBlocks(player, startBlock, blockType) {
        const heldStaff = InventoryUtils.getHeldItem(player);
        const maxBlocks = heldStaff ? StaffConfig.maxBlocks[heldStaff.typeId] || 20 : 20;
        const maxDist = heldStaff ? StaffConfig.getViewDistance(heldStaff.typeId) : 64;
        const connSettings = PlayerPatternSettings.getConnectedSettings(player.name);
        const actualMax = Math.min(connSettings.maxBlocks, maxBlocks);
        const targetFace = player.getBlockFromViewDirection({
            maxDistance: maxDist,
            includeLiquidBlocks: true,
            includePassableBlocks: false
        })?.face || "up";
        const facing = PatternEngine.getPlayerFacing(player);
        return BlockUtils.findSurfaceConnectedBlocks(startBlock, blockType, targetFace, actualMax, connSettings.directionLock, facing).filter(pos => {
            try {
                const block = player.dimension.getBlock(pos);
                return block ? !BlockUtils.hasContainerOrComplexData(block) : false;
            }
            catch {
                return false;
            }
        });
    }
    static findAreaBlocks(player, center, blockType, radius) {
        const allPositions = PatternEngine.calculateAreaDestroy(center, radius);
        const validPositions = [];
        for (const pos of allPositions) {
            try {
                const block = player.dimension.getBlock(pos);
                if (block && block.typeId === blockType && !BlockUtils.hasContainerOrComplexData(block)) {
                    validPositions.push(pos);
                }
            }
            catch { }
        }
        return validPositions;
    }
    static resolveCompatiblePermutation(oldPermutation, newBlockType) {
        let targetPerm = BlockPermutation.resolve(newBlockType);
        try {
            const oldStates = oldPermutation.getAllStates();
            const orientationKeys = [
                "weirdo_direction",
                "upside_down_bit",
                "minecraft:vertical_half",
                "minecraft:cardinal_direction",
                "minecraft:facing_direction",
                "facing_direction",
                "pillar_axis",
                "direction"
            ];
            for (const key of orientationKeys) {
                if (key in oldStates) {
                    try {
                        targetPerm = targetPerm.withState(key, oldStates[key]);
                    }
                    catch { }
                }
            }
        }
        catch { }
        return targetPerm;
    }
    static replaceBlocks(player, positions, expectedOldType, newBlockType, isCreative) {
        const entries = [];
        let soundCounter = 0;
        for (const pos of positions) {
            try {
                const block = player.dimension.getBlock(pos);
                if (!block || block.typeId !== expectedOldType || BlockUtils.hasContainerOrComplexData(block))
                    continue;
                if (!isCreative && StaffEngine.isBlockUndestroyable(block.typeId))
                    continue;
                const oldPermutation = block.permutation;
                const dropType = !isCreative ? InventoryUtils.getSurvivalDropType(block.typeId) : null;
                const newPermutation = this.resolveCompatiblePermutation(oldPermutation, newBlockType);
                block.setPermutation(newPermutation);
                entries.push(UndoEngine.createEntry(player, pos, oldPermutation, newPermutation, !isCreative ? newBlockType : undefined, dropType ?? undefined));
                soundCounter++;
                if (soundCounter % 10 === 0) {
                    player.playSound("random.pop", { pitch: 0.9 + Math.random() * 0.4, volume: 0.3 });
                }
            }
            catch (error) {
                console.warn(`Failed to replace block at ${pos.x},${pos.y},${pos.z}: ${error}`);
            }
        }
        return entries;
    }
    static spawnSelectionParticles(player, location, color) {
        const particleType = color === "yellow"
            ? "minecraft:crop_growth_emitter"
            : "minecraft:villager_happy";
        for (let i = 0; i < 5; i++) {
            const particlePos = { x: location.x + 0.5, y: location.y + 0.5 + (i * 0.2), z: location.z + 0.5 };
            try {
                player.dimension.spawnParticle(particleType, particlePos);
            }
            catch (error) {
                console.warn(`Failed to spawn particle: ${error}`);
            }
        }
    }
    static getReplacePreview(player, targetBlock) {
        if (!targetBlock)
            return null;
        const settings = PlayerPatternSettings.getReplaceSettings(player.name);
        const effectiveFind = settings.findBlock ?? (settings.weatheringMode && BlockUtils.getWeatheredVariants(targetBlock.typeId).length > 0
            ? targetBlock.typeId
            : null);
        if (!effectiveFind)
            return null;
        if (!settings.usePalette && !settings.weatheringMode && !settings.replaceBlock)
            return null;
        const replaceMode = PlayerPatternSettings.getReplaceMode(player.name);
        if (replaceMode === "box2p") {
            const pos1 = RegionEngine.getPos1(player.name, player.dimension.id, "replace");
            if (!pos1)
                return null;
            const heldStaff = InventoryUtils.getHeldItem(player);
            const maxVol = heldStaff ? StaffConfig.getMaxBox2PVolume(heldStaff.typeId) : 400;
            const boxPositions = PatternEngine.calculateBox2P(pos1, targetBlock.location, "filled", maxVol);
            return boxPositions.filter(pos => {
                try {
                    const block = player.dimension.getBlock(pos);
                    return block ? (block.typeId === effectiveFind && !BlockUtils.hasContainerOrComplexData(block)) : false;
                }
                catch {
                    return false;
                }
            });
        }
        if (targetBlock.typeId !== effectiveFind)
            return null;
        if (replaceMode === "connected") {
            return this.findConnectedBlocks(player, targetBlock, effectiveFind);
        }
        else {
            const heldStaff = InventoryUtils.getHeldItem(player);
            const maxArea = heldStaff ? StaffConfig.maxReplaceArea[heldStaff.typeId] || 5 : 5;
            const radius = Math.min(settings.areaSize, maxArea);
            return this.findAreaBlocks(player, targetBlock.location, effectiveFind, radius);
        }
    }
    static clearReplaceSelections(player) {
        RegionEngine.clearPos1(player.name);
        PlayerPatternSettings.clearReplaceBlocks(player.name);
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendMessage(player, "Seleções de substituição limpas.");
        player.playSound("random.orb", { pitch: 0.5, volume: 1.0 });
    }
}
