import { world, system, GameMode, BlockPermutation } from "@minecraft/server";
import { BlockSelectionManager } from "../api/models/blockSelection";
import { PlayerPatternSettings } from "../api/models/playerPatternSettings";
import { StaffConfig } from "../config/staffConfig";
import { VectorUtils } from "../api/vectorUtils";
import { BlockUtils } from "../api/blockUtils";
import { InventoryUtils } from "../api/inventoryUtils";
import { PlayerUtils } from "../api/playerUtils";
import { HoloPreviewEngine } from "./holoEngine";
import { MessageUtils } from "../api/messageUtils";
import { StaffUI } from "../ui/staffUi";
import { ReplaceEngine } from "./replaceEngine";
import { PatternEngine } from "./patternEngine";
import { GuideEngine } from "./guideEngine";
import { UndoEngine } from "./undoEngine";
import { RegionEngine } from "./regionEngine";
import { BlueprintEngine } from "./blueprintEngine";
export class StaffEngine {
    static initialize() {
        HoloPreviewEngine.initialize();
        RegionEngine.initialize();
        BlueprintEngine.initialize();
        world.afterEvents.itemUse.subscribe(this.handleInteraction.bind(this));
        world.beforeEvents.playerBreakBlock.subscribe((event) => {
            if (!event.itemStack || !StaffConfig.isStaff(event.itemStack.typeId))
                return;
            event.cancel = true;
            if (event.player.isSneaking) {
                const player = event.player;
                const loc = { ...event.block.location };
                const dimId = event.block.dimension.id;
                system.run(() => {
                    this.handleQuickPickBlock(player, loc, dimId);
                });
            }
        });
        world.afterEvents.entityHitBlock.subscribe((event) => {
            if (event.damagingEntity.typeId !== "minecraft:player")
                return;
            const player = event.damagingEntity;
            if (!player.isSneaking || !PlayerUtils.isHoldingStaff(player))
                return;
            this.handleQuickPickBlock(player, event.hitBlock.location, player.dimension.id);
        });
        system.runInterval(() => {
            this.processPlacementQueues();
        }, 1);
        world.beforeEvents.playerLeave.subscribe((event) => {
            const name = event.player.name;
            system.run(() => {
                this.placementQueues.delete(name);
                this.quickPickCooldowns.delete(name);
            });
        });
    }
    static playStaffPlaceSound(player, staffId, pitchOffset = 0) {
        const base = StaffConfig.getBaseStaffId(staffId);
        if (base === "arc_st:amethyst_staff" || base === "arc_st:echo_staff") {
            player.playSound("chime.amethyst_block", { pitch: 0.9 + Math.random() * 0.4 + pitchOffset, volume: 0.65 });
        }
        else {
            player.playSound(this.SOUNDS.place, { pitch: 0.9 + Math.random() * 0.35 + pitchOffset, volume: 0.7 });
        }
    }
    static toggleSupplyChestAtBlock(player, block) {
        if (!InventoryUtils.isLinkableContainer(block))
            return false;
        const loc = block.location;
        const dimId = block.dimension.id;
        const current = PlayerPatternSettings.getSupplyChest(player.name);
        if (current && current.x === loc.x && current.y === loc.y && current.z === loc.z && current.dimensionId === dimId) {
            PlayerPatternSettings.setSupplyChest(player.name, null);
            PlayerUtils.updatePlayerHotbarMessage(player);
            MessageUtils.sendMessage(player, "§eBaú de Suprimentos desvinculado.");
            player.playSound("random.click", { pitch: 0.9, volume: 0.8 });
            return true;
        }
        PlayerPatternSettings.setSupplyChest(player.name, {
            x: loc.x,
            y: loc.y,
            z: loc.z,
            dimensionId: dimId
        });
        for (let i = 0; i < 6; i++) {
            try {
                block.dimension.spawnParticle("minecraft:villager_happy", {
                    x: loc.x + 0.5,
                    y: loc.y + 0.8 + i * 0.15,
                    z: loc.z + 0.5
                });
            }
            catch { }
        }
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendSuccessMessage(player, `Baú de Suprimentos vinculado em (${loc.x}, ${loc.y}, ${loc.z})! Alcance ativo de 100 blocos.`);
        player.playSound(this.SOUNDS.success, { pitch: 1.25, volume: 0.8 });
        return true;
    }
    static linkAimedSupplyChest(player) {
        const hit = player.getBlockFromViewDirection({
            maxDistance: 12,
            includeLiquidBlocks: false,
            includePassableBlocks: false
        });
        if (!hit?.block || !InventoryUtils.isLinkableContainer(hit.block)) {
            return false;
        }
        return this.toggleSupplyChestAtBlock(player, hit.block);
    }
    static handleQuickPickBlock(player, location, dimensionId) {
        const now = system.currentTick;
        const lastTick = this.quickPickCooldowns.get(player.name) ?? -100;
        if (now - lastTick < 6)
            return;
        this.quickPickCooldowns.set(player.name, now);
        try {
            const block = world.getDimension(dimensionId).getBlock(location);
            if (!block || block.typeId === "minecraft:air" || HoloPreviewEngine.isPreviewBlock(block.typeId))
                return;
            HoloPreviewEngine.unfreezePreview(player.name);
            HoloPreviewEngine.clearAllPreviews(player);
            if (InventoryUtils.isLinkableContainer(block)) {
                this.toggleSupplyChestAtBlock(player, block);
                return;
            }
            const mode = PlayerPatternSettings.getMode(player.name);
            if (mode === "replace") {
                ReplaceEngine.handleReplaceSelection(player, block);
            }
            else if (mode === "blueprint") {
                const held = InventoryUtils.getHeldItem(player);
                if (held)
                    this.handleBlueprintMode(player, held);
            }
            else {
                this.handleBlockSelection(player, block, mode, true);
            }
        }
        catch { }
    }
    static resolveOrientedPerm(player, basePerm, pos, ctx) {
        if (!ctx || !PlayerPatternSettings.isAutoOrientBlocks(player.name)) {
            return basePerm;
        }
        return BlockUtils.getAutoOrientedPermutation(basePerm, ctx.pattern, player, pos, ctx.center, {
            stairsDir: ctx.stairsDir,
            lineDir: ctx.lineDir,
            inverted: ctx.inverted,
            clockwise: ctx.clockwise,
            frameBounds: ctx.frameBounds
        });
    }
    static applyAutoTorches(player, referencePositions, undoEntries, isCreative, mode) {
        if (!PlayerPatternSettings.isAutoTorch(player.name) || referencePositions.length === 0)
            return 0;
        const spacing = PlayerPatternSettings.getTorchSpacing(player.name);
        const minDistSq = spacing * spacing;
        const dim = player.dimension;
        const candidates = [];
        if (mode === "surface") {
            const topByColumn = new Map();
            for (const p of referencePositions) {
                const key = `${p.x},${p.z}`;
                const existing = topByColumn.get(key);
                if (!existing || p.y > existing.y) {
                    topByColumn.set(key, p);
                }
            }
            for (const p of topByColumn.values()) {
                try {
                    const base = dim.getBlock(p);
                    const above = dim.getBlock({ x: p.x, y: p.y + 1, z: p.z });
                    if (base && !base.isAir && !base.isLiquid && above && above.typeId === "minecraft:air") {
                        candidates.push({ x: p.x, y: p.y + 1, z: p.z });
                    }
                }
                catch { }
            }
        }
        else {
            const minByColumn = new Map();
            for (const p of referencePositions) {
                const key = `${p.x},${p.z}`;
                const existing = minByColumn.get(key);
                if (!existing || p.y < existing.y) {
                    minByColumn.set(key, p);
                }
            }
            for (const p of minByColumn.values()) {
                try {
                    const cell = dim.getBlock(p);
                    const below = dim.getBlock({ x: p.x, y: p.y - 1, z: p.z });
                    if (cell && cell.typeId === "minecraft:air" && below && !below.isAir && !below.isLiquid) {
                        candidates.push({ x: p.x, y: p.y, z: p.z });
                    }
                }
                catch { }
            }
        }
        candidates.sort((a, b) => (a.x - b.x) || (a.z - b.z) || (a.y - b.y));
        const chosen = [];
        let torchesPlaced = 0;
        for (const cand of candidates) {
            const tooClose = chosen.some(prev => {
                const dx = cand.x - prev.x;
                const dy = cand.y - prev.y;
                const dz = cand.z - prev.z;
                return dx * dx + dy * dy + dz * dz < minDistSq;
            });
            if (tooClose)
                continue;
            const torchType = InventoryUtils.findAvailableTorchItem(player, isCreative);
            if (!torchType)
                break;
            try {
                const targetBlock = dim.getBlock(cand);
                if (!targetBlock || targetBlock.typeId !== "minecraft:air")
                    continue;
                const oldPerm = targetBlock.permutation;
                const torchPerm = BlockPermutation.resolve(torchType);
                targetBlock.setPermutation(torchPerm);
                if (!isCreative) {
                    InventoryUtils.removeItemsFromInventory(player, torchType, 1);
                }
                undoEntries.push(UndoEngine.createEntry(player, cand, oldPerm, torchPerm, !isCreative ? torchType : undefined));
                chosen.push(cand);
                torchesPlaced++;
            }
            catch { }
        }
        return torchesPlaced;
    }
    static processPlacementQueues() {
        for (const player of world.getAllPlayers()) {
            const job = this.placementQueues.get(player.name);
            if (!job)
                continue;
            if (job.blueprintItems) {
                if (job.blueprintItems.length === 0) {
                    this.placementQueues.delete(player.name);
                    if (job.placed > 0) {
                        UndoEngine.recordOperation(player, job.undoEntries);
                        PlayerPatternSettings.recordStats(player, "blueprint", job.placed);
                        InventoryUtils.reduceDurability(job.staff, 1, player, "construction");
                        PlayerUtils.updatePlayerHotbarMessage(player);
                        const missNote = (job.missingBlueprintItems ?? 0) > 0
                            ? ` §7(${job.missingBlueprintItems} ausentes no estoque)`
                            : "";
                        MessageUtils.sendMessage(player, `§aPlanta colada: ${job.placed} blocos colocados!${missNote}`);
                        player.playSound(this.SOUNDS.success, { pitch: 1.15, volume: 0.75 });
                    }
                    else {
                        MessageUtils.sendErrorMessage(player, "Não foi possível colar blocos da planta (espaço ocupado ou faltam itens).");
                    }
                    continue;
                }
                const bpBatch = job.blueprintItems.splice(0, this.ASYNC_BATCH_SIZE);
                const dim = world.getDimension(job.dimensionId);
                for (const entry of bpBatch) {
                    if (!job.isCreative && InventoryUtils.countItemsInInventory(player, entry.typeId) <= 0) {
                        job.missingBlueprintItems = (job.missingBlueprintItems ?? 0) + 1;
                        continue;
                    }
                    const placedRes = this.tryPlaceBlock(dim, entry.pos, entry.permutation);
                    if (placedRes !== null) {
                        if (!job.isCreative) {
                            InventoryUtils.removeItemsFromInventory(player, entry.typeId, 1);
                        }
                        job.undoEntries.push(UndoEngine.createEntry(player, entry.pos, placedRes.oldPermutation, placedRes.newPermutation, !job.isCreative ? entry.typeId : undefined));
                        job.placed++;
                    }
                }
                if (job.placed > 0) {
                    this.playStaffPlaceSound(player, job.staff.typeId);
                }
                continue;
            }
            if (job.positions.length === 0) {
                this.placementQueues.delete(player.name);
                if (job.placed > 0) {
                    const pat = job.orientContext?.pattern ?? "";
                    if (pat === "floor" || pat === "box2p" || pat === "overlay" || pat === "connected") {
                        this.applyAutoTorches(player, job.placedPositions, job.undoEntries, job.isCreative, "surface");
                    }
                    UndoEngine.recordOperation(player, job.undoEntries);
                }
                this.finalizePlacement(player, job.staff, job.blockType, job.placed, job.isCreative, true);
                continue;
            }
            const batch = job.positions.splice(0, this.ASYNC_BATCH_SIZE);
            let stoppedForItems = false;
            const dim = world.getDimension(job.dimensionId);
            for (const pos of batch) {
                if (job.isRandomizer && job.palette.length > 0) {
                    let candidates = job.palette;
                    if (!job.isCreative) {
                        candidates = job.palette.filter(bt => InventoryUtils.countItemsInInventory(player, bt) > 0);
                        if (candidates.length === 0) {
                            stoppedForItems = true;
                            break;
                        }
                    }
                    const blockId = PlayerPatternSettings.pickWeightedBlock(player.name, candidates);
                    let perm = BlockPermutation.resolve(blockId);
                    perm = this.resolveOrientedPerm(player, perm, pos, job.orientContext);
                    const placedResult = this.tryPlaceBlock(dim, pos, perm);
                    if (placedResult !== null) {
                        if (!job.isCreative) {
                            InventoryUtils.removeItemsFromInventory(player, blockId, 1);
                        }
                        job.undoEntries.push(UndoEngine.createEntry(player, pos, placedResult.oldPermutation, placedResult.newPermutation, !job.isCreative ? blockId : undefined));
                        job.placedPositions.push(pos);
                        job.placed++;
                    }
                }
                else if (job.permutation) {
                    if (!job.isCreative && InventoryUtils.countItemsInInventory(player, job.blockType) <= 0) {
                        stoppedForItems = true;
                        break;
                    }
                    const perm = this.resolveOrientedPerm(player, job.permutation, pos, job.orientContext);
                    const placedResult = this.tryPlaceBlock(dim, pos, perm);
                    if (placedResult !== null) {
                        if (!job.isCreative) {
                            InventoryUtils.removeItemsFromInventory(player, job.blockType, 1);
                        }
                        job.undoEntries.push(UndoEngine.createEntry(player, pos, placedResult.oldPermutation, placedResult.newPermutation, !job.isCreative ? job.blockType : undefined));
                        job.placedPositions.push(pos);
                        job.placed++;
                    }
                }
            }
            if (job.placed > 0) {
                this.playStaffPlaceSound(player, job.staff.typeId);
            }
            if (stoppedForItems) {
                job.positions = [];
            }
        }
    }
    static getBlockFromView(player, staffId) {
        const maxDistance = staffId ? StaffConfig.getViewDistance(staffId) : 64;
        return player.getBlockFromViewDirection({
            maxDistance,
            includeLiquidBlocks: true,
            includePassableBlocks: false
        });
    }
    static async handleInteraction(event) {
        const { itemStack: item, source: player } = event;
        if (!item)
            return;
        if (item.typeId === "arc_st:architect_tome") {
            this.handleArchitectTome(player);
            return;
        }
        if (!StaffConfig.isStaff(item.typeId))
            return;
        if (this.placementQueues.has(player.name)) {
            MessageUtils.sendErrorMessage(player, "Aguarde a construção atual terminar.");
            return;
        }
        if (player.isSneaking) {
            await StaffUI.openMainMenu(player);
            return;
        }
        const currentMode = PlayerPatternSettings.getMode(player.name);
        const syncedStaff = InventoryUtils.syncHeldStaffAppearance(player, currentMode) ?? item;
        PlayerUtils.syncAdjacentHotbarSelection(player);
        const hasSelection = BlockSelectionManager.hasSelection(player.name);
        switch (currentMode) {
            case "construction":
                this.handleConstructionMode(player, syncedStaff, hasSelection);
                break;
            case "destruction":
                this.handleDestructionMode(player, syncedStaff, hasSelection);
                break;
            case "replace":
                this.handleReplaceMode(player, syncedStaff);
                break;
            case "blueprint":
                this.handleBlueprintMode(player, syncedStaff);
                break;
        }
    }
    static handleBlueprintMode(player, staff) {
        const maxDist = StaffConfig.getViewDistance(staff.typeId);
        if (BlueprintEngine.isCapturing(player.name)) {
            const hit = this.getBlockFromView(player, staff.typeId);
            const pos1 = BlueprintEngine.getCopyPos1(player.name, player.dimension.id);
            if (!hit?.block || hit.block.typeId === "minecraft:air" || HoloPreviewEngine.isPreviewBlock(hit.block.typeId)) {
                if (pos1) {
                    BlueprintEngine.clearCopyPos1(player.name);
                    HoloPreviewEngine.clearAllPreviews(player);
                    PlayerUtils.updatePlayerHotbarMessage(player);
                    MessageUtils.sendMessage(player, "§7Marcação do Ponto A da planta cancelada.");
                }
                else {
                    MessageUtils.sendErrorMessage(player, "Aponte para um bloco sólido para marcar o Ponto A da Planta!");
                    player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
                }
                return;
            }
            const loc = hit.block.location;
            if (!pos1) {
                BlueprintEngine.setCopyPos1(player, loc);
                try {
                    player.dimension.spawnParticle("minecraft:villager_happy", {
                        x: loc.x + 0.5, y: loc.y + 1.0, z: loc.z + 0.5
                    });
                }
                catch { }
                PlayerUtils.updatePlayerHotbarMessage(player);
                MessageUtils.sendSuccessMessage(player, `Ponto A marcado em (${loc.x}, ${loc.y}, ${loc.z})! Agora clique no Ponto B oposto para copiar.`);
                player.playSound(this.SOUNDS.selection, { pitch: 1.15, volume: 1.0 });
                return;
            }
            HoloPreviewEngine.clearAllPreviews(player);
            const isCreative = player.getGameMode() === GameMode.creative;
            const res = BlueprintEngine.captureRegion(player, pos1, loc, isCreative, (t) => this.isBlockUndestroyable(t));
            PlayerUtils.updatePlayerHotbarMessage(player);
            if (res.ok) {
                MessageUtils.sendSuccessMessage(player, res.message);
                player.playSound(this.SOUNDS.success, { pitch: 1.2, volume: 0.8 });
            }
            else {
                MessageUtils.sendErrorMessage(player, res.message);
                player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
            }
            return;
        }
        const anchor = HoloPreviewEngine.isPreviewFrozen(player.name)
            ? (HoloPreviewEngine.consumeFrozenBlueprintAnchor(player.name) ?? VectorUtils.getSurfacePlacementCenter(player, maxDist))
            : VectorUtils.getSurfacePlacementCenter(player, maxDist);
        HoloPreviewEngine.clearAllPreviews(player);
        this.executeBlueprintPaste(player, staff, anchor);
    }
    static executeBlueprintPaste(player, staff, anchor) {
        const transformed = BlueprintEngine.getTransformedBlocks(player.name, anchor);
        if (transformed.length === 0) {
            MessageUtils.sendErrorMessage(player, "Nenhuma planta ativa para colar.");
            return;
        }
        const isCreative = player.getGameMode() === GameMode.creative;
        if (!isCreative) {
            const reqs = BlueprintEngine.getRequiredMaterials(player.name);
            let anyAvailable = false;
            for (const bt of reqs.keys()) {
                if (InventoryUtils.countItemsInInventory(player, bt) > 0) {
                    anyAvailable = true;
                    break;
                }
            }
            if (!anyAvailable) {
                MessageUtils.sendErrorMessage(player, "Você não possui os blocos necessários da planta no inventário nem no Baú de Suprimentos!");
                player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
                return;
            }
        }
        if (transformed.length > this.ASYNC_BATCH_SIZE) {
            this.placementQueues.set(player.name, {
                positions: [],
                placedPositions: [],
                blueprintItems: transformed,
                missingBlueprintItems: 0,
                dimensionId: player.dimension.id,
                isCreative,
                isRandomizer: false,
                palette: [],
                blockType: "",
                permutation: null,
                staff,
                undoEntries: [],
                placed: 0
            });
            MessageUtils.sendMessage(player, `§7Colando planta (${transformed.length} blocos)...`);
            return;
        }
        const undoEntries = [];
        let placed = 0;
        let missing = 0;
        for (const item of transformed) {
            if (!isCreative && InventoryUtils.countItemsInInventory(player, item.typeId) <= 0) {
                missing++;
                continue;
            }
            const placedRes = this.tryPlaceBlock(player.dimension, item.pos, item.permutation);
            if (placedRes !== null) {
                if (!isCreative) {
                    InventoryUtils.removeItemsFromInventory(player, item.typeId, 1);
                }
                undoEntries.push(UndoEngine.createEntry(player, item.pos, placedRes.oldPermutation, placedRes.newPermutation, !isCreative ? item.typeId : undefined));
                placed++;
                if (placed % 6 === 0)
                    this.playStaffPlaceSound(player, staff.typeId);
            }
        }
        if (placed > 0) {
            UndoEngine.recordOperation(player, undoEntries);
            PlayerPatternSettings.recordStats(player, "blueprint", placed);
            InventoryUtils.reduceDurability(staff, 1, player, "construction");
            PlayerUtils.updatePlayerHotbarMessage(player);
            const missNote = missing > 0 ? ` §7(${missing} ausentes no estoque)` : "";
            MessageUtils.sendMessage(player, `§aPlanta colada: ${placed} blocos colocados!${missNote}`);
            player.playSound(this.SOUNDS.success, { pitch: 1.15, volume: 0.75 });
        }
        else {
            MessageUtils.sendErrorMessage(player, "Nenhum bloco pôde ser colado neste local (espaço já ocupado).");
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
        }
    }
    static handleArchitectTome(player) {
        GuideEngine.openTutorial(player);
    }
    static handleConstructionMode(player, staff, hasSelection) {
        const blockFromView = this.getBlockFromView(player, staff.typeId);
        const pattern = PlayerPatternSettings.getConstructionPattern(player.name);
        const maxPal = StaffConfig.getMaxPaletteSize(staff.typeId);
        const isRandomizer = PlayerPatternSettings.isRandomizerActive(player.name);
        const isRandomizerPending = isRandomizer && PlayerPatternSettings.isRandomizerPending(player.name);
        const paletteReady = isRandomizer && !isRandomizerPending && PlayerPatternSettings.getPalette(player.name, maxPal).length > 0;
        if (pattern === "box2p" && (hasSelection || paletteReady)) {
            if (!StaffConfig.canUsePattern(staff.typeId, "box2p")) {
                MessageUtils.sendErrorMessage(player, "A Caixa de 2 Pontos requer Cetro de Ferro ou superior!");
                player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
                return;
            }
            const pos1 = RegionEngine.getPos1(player.name, player.dimension.id, "construction");
            if (!pos1) {
                if (!blockFromView?.block && !player.isSneaking) {
                    const maxDist = StaffConfig.getViewDistance(staff.typeId);
                    const anchor = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                    RegionEngine.setPos1(player, anchor, "construction");
                    PlayerUtils.updatePlayerHotbarMessage(player);
                    MessageUtils.sendSuccessMessage(player, `Ponto 1 marcado em (${anchor.x}, ${anchor.y}, ${anchor.z})! Aponte para o Ponto 2 e use o cetro.`);
                    player.playSound(this.SOUNDS.selection, { pitch: 1.15, volume: 1.0 });
                    return;
                }
                const maxDist = StaffConfig.getViewDistance(staff.typeId);
                const anchor = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                RegionEngine.setPos1(player, anchor, "construction");
                try {
                    player.dimension.spawnParticle("minecraft:villager_happy", {
                        x: anchor.x + 0.5, y: anchor.y + 0.5, z: anchor.z + 0.5
                    });
                }
                catch { }
                PlayerUtils.updatePlayerHotbarMessage(player);
                MessageUtils.sendSuccessMessage(player, `Ponto 1 marcado em (${anchor.x}, ${anchor.y}, ${anchor.z})! Aponte para o Ponto 2 e use o cetro.`);
                player.playSound(this.SOUNDS.selection, { pitch: 1.15, volume: 1.0 });
                return;
            }
            const frozenPositions = HoloPreviewEngine.consumeFrozenPositions(player.name);
            const s = PlayerPatternSettings.getBox2PSettings(player.name);
            let positions;
            if (frozenPositions) {
                positions = frozenPositions;
            }
            else {
                const maxDist = StaffConfig.getViewDistance(staff.typeId);
                const pos2 = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                const maxVol = StaffConfig.getMaxBox2PVolume(staff.typeId);
                positions = PatternEngine.calculateBox2P(pos1, pos2, s.fillStyle, maxVol);
            }
            RegionEngine.clearPos1(player.name);
            const bounds = s.fillStyle === "frame" ? PatternEngine.getBounds(positions) : undefined;
            this.placeExactPositions(player, staff, positions, {
                pattern: "box2p",
                center: pos1,
                frameBounds: bounds
            });
            return;
        }
        if (HoloPreviewEngine.hasBlockPreview(player) && (!isRandomizer || paletteReady)) {
            if (!StaffConfig.canUsePattern(staff.typeId, pattern)) {
                HoloPreviewEngine.unfreezePreview(player.name);
                HoloPreviewEngine.clearAllPreviews(player);
                MessageUtils.sendErrorMessage(player, "Este padrão está bloqueado para o nível do seu cetro!");
                player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
                return;
            }
            const frozenPositions = HoloPreviewEngine.consumeFrozenPositions(player.name);
            if (frozenPositions) {
                const bounds = pattern === "box2p" && PlayerPatternSettings.getBox2PSettings(player.name).fillStyle === "frame"
                    ? PatternEngine.getBounds(frozenPositions)
                    : undefined;
                const center = frozenPositions[0] ?? player.location;
                this.placeExactPositions(player, staff, frozenPositions, {
                    pattern,
                    center,
                    stairsDir: PlayerPatternSettings.getStairsSettings(player.name).direction,
                    lineDir: PatternEngine.getSnappedLineDirection(player, PlayerPatternSettings.getLineSettings(player.name).snap ?? "free"),
                    inverted: PlayerPatternSettings.getPyramidSettings(player.name).inverted,
                    frameBounds: bounds
                });
                return;
            }
            this.executeConstructionPlacement(player, staff, pattern, blockFromView);
            return;
        }
        if (!blockFromView?.block || blockFromView.block.typeId === "minecraft:air") {
            if (hasSelection && !isRandomizer && !PlayerPatternSettings.isAutoAdjacentSlot(player.name)) {
                this.clearPlayerSelection(player);
            }
            return;
        }
        const targetBlock = blockFromView.block;
        if (HoloPreviewEngine.isPreviewBlock(targetBlock.typeId))
            return;
        this.handleBlockSelection(player, targetBlock, "construction");
    }
    static handleDestructionMode(player, staff, hasSelection) {
        const blockFromView = this.getBlockFromView(player, staff.typeId);
        const pattern = PlayerPatternSettings.getDestructionPattern(player.name);
        if (pattern === "foliage") {
            const frozenPositions = HoloPreviewEngine.consumeFrozenPositions(player.name);
            HoloPreviewEngine.clearAllPreviews(player);
            if (frozenPositions) {
                this.executeFoliageClear(player, staff, frozenPositions);
                return;
            }
            const maxDist = StaffConfig.getViewDistance(staff.typeId);
            const hit = player.getBlockFromViewDirection({
                maxDistance: maxDist,
                includeLiquidBlocks: false,
                includePassableBlocks: true
            });
            if (!hit?.block) {
                MessageUtils.sendErrorMessage(player, "Aponte para o terreno ou vegetação para limpar!");
                player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
                return;
            }
            const settings = PlayerPatternSettings.getFoliageDestroySettings(player.name);
            const maxRadius = Math.max(4, (StaffConfig.maxReplaceArea[staff.typeId] || 3) + 3);
            const radius = Math.min(settings.radius, maxRadius);
            const positions = PatternEngine.calculateFoliageClear(hit.block.location, player.dimension, radius, settings.includeLeaves);
            this.executeFoliageClear(player, staff, positions);
            return;
        }
        if (pattern === "box2p" && hasSelection) {
            const pos1 = RegionEngine.getPos1(player.name, player.dimension.id, "destruction");
            if (!pos1) {
                if (!blockFromView?.block || blockFromView.block.typeId === "minecraft:air") {
                    this.clearPlayerSelection(player);
                    return;
                }
                const loc = blockFromView.block.location;
                RegionEngine.setPos1(player, loc, "destruction");
                PlayerUtils.updatePlayerHotbarMessage(player);
                MessageUtils.sendSuccessMessage(player, `Ponto 1 de Demolição marcado em (${loc.x}, ${loc.y}, ${loc.z})! Aponte para o Ponto 2.`);
                player.playSound(this.SOUNDS.selection, { pitch: 1.15, volume: 1.0 });
                return;
            }
            const selected = BlockSelectionManager.getSelection(player.name);
            const frozenPositions = HoloPreviewEngine.consumeFrozenPositions(player.name);
            HoloPreviewEngine.clearAllPreviews(player);
            RegionEngine.clearPos1(player.name);
            if (!selected)
                return;
            const matchSim = PlayerPatternSettings.isMatchSimilarBlocks(player.name);
            let validPositions = [];
            if (frozenPositions) {
                validPositions = frozenPositions;
            }
            else if (blockFromView?.block) {
                const maxVol = StaffConfig.getMaxBox2PVolume(staff.typeId);
                const box = PatternEngine.calculateBox2P(pos1, blockFromView.block.location, "filled", maxVol);
                validPositions = HoloPreviewEngine.filterDestroyableMatches(player, box, selected.blockType, matchSim);
            }
            this.executeDestruction(player, staff, validPositions, selected.blockType, player.getGameMode() === GameMode.creative, matchSim, "box2p");
            return;
        }
        if (HoloPreviewEngine.hasBlockPreview(player)) {
            const frozenPositions = HoloPreviewEngine.consumeFrozenPositions(player.name);
            if (frozenPositions) {
                const selected = BlockSelectionManager.getSelection(player.name);
                if (selected) {
                    HoloPreviewEngine.clearAllPreviews(player);
                    this.executeDestruction(player, staff, frozenPositions, selected.blockType, player.getGameMode() === GameMode.creative, PlayerPatternSettings.isMatchSimilarBlocks(player.name), pattern);
                }
                return;
            }
            this.executeDestructionPlacement(player, staff, pattern);
            return;
        }
        if (!blockFromView?.block || blockFromView.block.typeId === "minecraft:air") {
            if (hasSelection)
                this.clearPlayerSelection(player);
            return;
        }
        const targetBlock = blockFromView.block;
        if (HoloPreviewEngine.isPreviewBlock(targetBlock.typeId))
            return;
        this.handleBlockSelection(player, targetBlock, "destruction");
    }
    static executeFoliageClear(player, staff, positions) {
        const isCreative = player.getGameMode() === GameMode.creative;
        const settings = PlayerPatternSettings.getFoliageDestroySettings(player.name);
        const airPerm = BlockPermutation.resolve("minecraft:air");
        const undoEntries = [];
        const drops = new Map();
        let cleared = 0;
        for (const pos of positions) {
            try {
                const block = player.dimension.getBlock(pos);
                if (!block || !BlockUtils.isFoliageOrSnow(block.typeId, settings.includeLeaves))
                    continue;
                const oldPerm = block.permutation;
                const dropType = !isCreative ? InventoryUtils.getSurvivalDropType(block.typeId) : null;
                block.setType("minecraft:air");
                undoEntries.push(UndoEngine.createEntry(player, pos, oldPerm, airPerm, undefined, dropType ?? undefined));
                if (dropType) {
                    drops.set(dropType, (drops.get(dropType) ?? 0) + 1);
                }
                cleared++;
            }
            catch { }
        }
        if (cleared > 0) {
            if (!isCreative) {
                for (const [dt, cnt] of drops.entries()) {
                    InventoryUtils.giveItemsOrDrop(player, dt, cnt);
                }
                InventoryUtils.reduceDurability(staff, 1, player, "destruction");
            }
            UndoEngine.recordOperation(player, undoEntries);
            PlayerPatternSettings.recordStats(player, "destroyed", cleared);
            PlayerUtils.updatePlayerHotbarMessage(player);
            MessageUtils.sendSuccessMessage(player, `${cleared} blocos de vegetação/neve limpos!`);
            player.playSound("dig.grass", { pitch: 1.1, volume: 0.7 });
        }
        else {
            MessageUtils.sendErrorMessage(player, "Nenhuma vegetação ou neve encontrada nesta área.");
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 0.6 });
        }
    }
    static handleReplaceMode(player, staff) {
        if (HoloPreviewEngine.hasBlockPreview(player)) {
            const settings = PlayerPatternSettings.getReplaceSettings(player.name);
            const readyToExecute = Boolean((settings.findBlock && (settings.replaceBlock || settings.usePalette || settings.weatheringMode)) ||
                settings.weatheringMode);
            if (readyToExecute) {
                const frozenPositions = HoloPreviewEngine.consumeFrozenPositions(player.name);
                HoloPreviewEngine.clearAllPreviews(player);
                if (frozenPositions) {
                    ReplaceEngine.executeReplacement(player, null, staff, frozenPositions);
                    return;
                }
                const realBlock = this.getBlockFromView(player, staff.typeId);
                if (realBlock?.block) {
                    ReplaceEngine.executeReplacement(player, realBlock.block, staff);
                }
            }
            return;
        }
        const blockFromView = this.getBlockFromView(player, staff.typeId);
        if (!blockFromView?.block || blockFromView.block.typeId === "minecraft:air") {
            const settings = PlayerPatternSettings.getReplaceSettings(player.name);
            if (settings.findBlock || settings.replaceBlock) {
                ReplaceEngine.clearReplaceSelections(player);
            }
            return;
        }
        const targetBlock = blockFromView.block;
        if (HoloPreviewEngine.isPreviewBlock(targetBlock.typeId))
            return;
        ReplaceEngine.handleReplaceSelection(player, targetBlock);
    }
    static executeConstructionPlacement(player, staff, pattern, blockFromView) {
        switch (pattern) {
            case "line":
                this.placeStraightLine(player, staff);
                break;
            case "connected":
                if (blockFromView?.block) {
                    const isRandomizer = PlayerPatternSettings.isRandomizerActive(player.name);
                    const selected = BlockSelectionManager.getSelection(player.name);
                    if ((selected && blockFromView.block.typeId === selected.blockType) || isRandomizer) {
                        this.placeConnectedBlocks(player, blockFromView.block, blockFromView.face, staff);
                    }
                }
                break;
            case "floor":
            case "stairs":
            case "overlay":
            case "spiral":
            case "gable_roof":
            case "torus":
            case "arch":
            case "circle":
            case "cylinder":
            case "sphere":
            case "dome":
            case "wall":
            case "cube":
            case "pyramid":
                this.placePattern(player, staff, pattern);
                break;
        }
    }
    static executeDestructionPlacement(player, staff, pattern) {
        if (pattern === "connected") {
            this.destroySelectedBlocks(player, staff);
        }
        else if (pattern === "area") {
            this.destroyAreaBlocks(player, staff);
        }
        else if (pattern === "tunnel") {
            this.destroyTunnelBlocks(player, staff);
        }
    }
    static handleBlockSelection(player, targetBlock, mode, forceSelect = false) {
        const playerName = player.name;
        const isCreative = player.getGameMode() === GameMode.creative;
        const heldStaff = InventoryUtils.getHeldItem(player);
        const maxPal = heldStaff ? StaffConfig.getMaxPaletteSize(heldStaff.typeId) : 6;
        if (BlockUtils.hasContainerOrComplexData(targetBlock)) {
            MessageUtils.sendErrorMessage(player, "Não é possível selecionar baús ou blocos compostos.");
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
            return;
        }
        if (!isCreative && this.isBlockUndestroyable(targetBlock.typeId)) {
            MessageUtils.sendErrorMessage(player, `Não é possível selecionar ${BlockUtils.getReadableBlockName(targetBlock.typeId)} no modo Sobrevivência.`);
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
            return;
        }
        if (mode === "construction" && PlayerPatternSettings.isRandomizerActive(playerName)) {
            const result = PlayerPatternSettings.addToPalette(playerName, targetBlock.typeId, maxPal);
            if (!result.added) {
                player.sendMessage(`§7${BlockUtils.getReadableBlockName(targetBlock.typeId)} já está na paleta.`);
                player.playSound(this.SOUNDS.selection, { pitch: 0.9, volume: 1.0 });
            }
            else {
                const count = PlayerPatternSettings.getPalette(playerName, maxPal).length;
                if (result.replaced) {
                    MessageUtils.sendSuccessMessage(player, `${BlockUtils.getReadableBlockName(targetBlock.typeId)} substituiu ${BlockUtils.getReadableBlockName(result.replaced)} na paleta (${count}/${maxPal})`);
                }
                else {
                    MessageUtils.sendSuccessMessage(player, `Adicionado ${BlockUtils.getReadableBlockName(targetBlock.typeId)} à paleta (${count}/${maxPal})`);
                }
                player.playSound(this.SOUNDS.selection, { pitch: 1.0, volume: 1.0 });
            }
            PlayerUtils.updatePlayerHotbarMessage(player);
            return;
        }
        const selected = BlockSelectionManager.getSelection(playerName);
        if (!forceSelect && selected && targetBlock.typeId === selected.blockType)
            return;
        BlockSelectionManager.setSelection(playerName, {
            blockType: targetBlock.typeId,
            permutation: targetBlock.permutation
        });
        HoloPreviewEngine.clearAllPreviews(player);
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendSelectionMessage(player, BlockUtils.getReadableBlockName(targetBlock.typeId));
        const pitch = selected && targetBlock.typeId !== selected.blockType ? 1.2 : 1.0;
        player.playSound(this.SOUNDS.selection, { pitch, volume: 1.0 });
    }
    static importHotbarToPalette(player) {
        const inventory = InventoryUtils.getPlayerInventory(player);
        if (!inventory?.container)
            return 0;
        const heldStaff = InventoryUtils.getHeldItem(player);
        const maxPal = heldStaff ? StaffConfig.getMaxPaletteSize(heldStaff.typeId) : 6;
        const isCreative = player.getGameMode() === GameMode.creative;
        let addedCount = 0;
        for (let slot = 0; slot < 9; slot++) {
            const item = inventory.container.getItem(slot);
            if (!item)
                continue;
            const typeId = item.typeId;
            if (StaffConfig.isStaff(typeId) || typeId === "arc_st:architect_tome" || HoloPreviewEngine.isPreviewBlock(typeId)) {
                continue;
            }
            if (!isCreative && this.isBlockUndestroyable(typeId))
                continue;
            const shortId = typeId.replace("minecraft:", "");
            if (shortId.includes("shulker_box") || shortId === "chest" || shortId === "trapped_chest" ||
                shortId === "barrel" || shortId === "ender_chest" || shortId.endsWith("_bed") ||
                shortId.endsWith("_door") || shortId.includes("sign") || shortId.includes("banner")) {
                continue;
            }
            try {
                BlockPermutation.resolve(typeId);
            }
            catch {
                continue;
            }
            const res = PlayerPatternSettings.addToPalette(player.name, typeId, maxPal);
            if (res.added)
                addedCount++;
        }
        return addedCount;
    }
    static clearPlayerSelection(player) {
        RegionEngine.clearPos1(player.name);
        BlockSelectionManager.clearSelection(player.name);
        HoloPreviewEngine.unfreezePreview(player.name);
        HoloPreviewEngine.clearAllPreviews(player);
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendClearMessage(player);
        player.playSound(this.SOUNDS.selection, { pitch: 0.5, volume: 1.0 });
    }
    static placeExactPositions(player, staff, rawPositions, orientContext) {
        const result = this.preparePlacement(player, staff);
        if (!result)
            return;
        const maxPal = StaffConfig.getMaxPaletteSize(staff.typeId);
        const palette = result.isRandomizer ? [...PlayerPatternSettings.getPalette(player.name, maxPal)] : [];
        const positions = rawPositions.slice(0, this.MAX_PATTERN_BLOCKS);
        if (positions.length > this.ASYNC_BATCH_SIZE) {
            this.placementQueues.set(player.name, {
                positions,
                placedPositions: [],
                dimensionId: player.dimension.id,
                isCreative: result.isCreative,
                isRandomizer: result.isRandomizer,
                palette,
                blockType: result.blockType,
                permutation: result.permutation,
                orientContext,
                staff,
                undoEntries: [],
                placed: 0
            });
            MessageUtils.sendMessage(player, `§7Construindo estrutura (${positions.length} posições)...`);
            return;
        }
        const undoEntries = [];
        const placedPositions = [];
        let placed = 0;
        if (result.isRandomizer && palette.length > 0) {
            const placedPerType = new Map();
            for (const pos of positions) {
                let candidates = palette;
                if (!result.isCreative) {
                    candidates = palette.filter(bt => InventoryUtils.countItemsInInventory(player, bt) > (placedPerType.get(bt) ?? 0));
                    if (candidates.length === 0)
                        break;
                }
                const blockId = PlayerPatternSettings.pickWeightedBlock(player.name, candidates);
                let perm = BlockPermutation.resolve(blockId);
                perm = this.resolveOrientedPerm(player, perm, pos, orientContext);
                const placedResult = this.tryPlaceBlock(player.dimension, pos, perm);
                if (placedResult !== null) {
                    undoEntries.push(UndoEngine.createEntry(player, pos, placedResult.oldPermutation, placedResult.newPermutation, !result.isCreative ? blockId : undefined));
                    placedPerType.set(blockId, (placedPerType.get(blockId) ?? 0) + 1);
                    placedPositions.push(pos);
                    placed++;
                    if (placed % 5 === 0)
                        this.playStaffPlaceSound(player, staff.typeId);
                }
            }
            if (!result.isCreative) {
                for (const [bt, count] of placedPerType) {
                    InventoryUtils.removeItemsFromInventory(player, bt, count);
                }
            }
        }
        else {
            const capped = positions.slice(0, result.available);
            for (const pos of capped) {
                const perm = this.resolveOrientedPerm(player, result.permutation, pos, orientContext);
                const placedResult = this.tryPlaceBlock(player.dimension, pos, perm);
                if (placedResult !== null) {
                    undoEntries.push(UndoEngine.createEntry(player, pos, placedResult.oldPermutation, placedResult.newPermutation, !result.isCreative ? result.blockType : undefined));
                    placedPositions.push(pos);
                    placed++;
                    if (placed % 5 === 0)
                        this.playStaffPlaceSound(player, staff.typeId);
                }
            }
        }
        if (placed > 0) {
            if (!result.isCreative && !result.isRandomizer && result.blockType) {
                InventoryUtils.removeItemsFromInventory(player, result.blockType, placed);
            }
            const pat = orientContext?.pattern ?? "";
            if (pat === "floor" || pat === "box2p" || pat === "overlay" || pat === "connected") {
                this.applyAutoTorches(player, placedPositions, undoEntries, result.isCreative, "surface");
            }
            UndoEngine.recordOperation(player, undoEntries);
        }
        this.finalizePlacement(player, staff, result.blockType, placed, result.isCreative, true);
    }
    static placePattern(player, staff, pattern) {
        const maxPatternSize = StaffConfig.maxPatternSize[staff.typeId] || 5;
        const maxDist = StaffConfig.getViewDistance(staff.typeId);
        const usesSurfaceCenter = pattern === "floor" || pattern === "stairs" || pattern === "arch" ||
            pattern === "cylinder" || pattern === "dome" || pattern === "pyramid" ||
            pattern === "spiral" || pattern === "gable_roof";
        const center = usesSurfaceCenter
            ? VectorUtils.getSurfacePlacementCenter(player, maxDist)
            : VectorUtils.getRaycastCenter(player, maxDist);
        let positions = [];
        switch (pattern) {
            case "floor": {
                const s = PlayerPatternSettings.getFloorSettings(player.name);
                positions = PatternEngine.calculateFloor(center, player, Math.min(s.width, maxPatternSize), Math.min(s.length, maxPatternSize), s.filled);
                break;
            }
            case "stairs": {
                const s = PlayerPatternSettings.getStairsSettings(player.name);
                positions = PatternEngine.calculateStairs(center, player, Math.min(s.width, maxPatternSize), Math.min(s.steps, maxPatternSize * 2), s.direction);
                break;
            }
            case "arch": {
                const s = PlayerPatternSettings.getArchSettings(player.name);
                positions = PatternEngine.calculateArch(center, player, Math.min(s.span, maxPatternSize * 2), Math.min(s.height, maxPatternSize), Math.min(s.depth, maxPatternSize));
                break;
            }
            case "circle": {
                const s = PlayerPatternSettings.getCircleSettings(player.name);
                positions = PatternEngine.calculateCircle(center, Math.min(s.radius, maxPatternSize), s.axis, s.filled);
                break;
            }
            case "cylinder": {
                const s = PlayerPatternSettings.getCylinderSettings(player.name);
                positions = PatternEngine.calculateCylinder(center, Math.min(s.radius, maxPatternSize), Math.min(s.height, maxPatternSize), s.type);
                break;
            }
            case "sphere": {
                const s = PlayerPatternSettings.getSphereSettings(player.name);
                positions = PatternEngine.calculateSphere(center, Math.min(s.radius, maxPatternSize), s.type);
                break;
            }
            case "dome": {
                const s = PlayerPatternSettings.getDomeSettings(player.name);
                positions = PatternEngine.calculateDome(center, Math.min(s.radius, maxPatternSize), s.type, s.inverted);
                break;
            }
            case "wall": {
                const s = PlayerPatternSettings.getWallSettings(player.name);
                positions = PatternEngine.calculateWall(center, player, Math.min(s.width, maxPatternSize), Math.min(s.height, maxPatternSize), s.thickness);
                break;
            }
            case "cube": {
                const s = PlayerPatternSettings.getCubeSettings(player.name);
                positions = PatternEngine.calculateCube(center, Math.min(s.size, maxPatternSize), s.type);
                break;
            }
            case "pyramid": {
                const s = PlayerPatternSettings.getPyramidSettings(player.name);
                positions = PatternEngine.calculatePyramid(center, Math.min(s.size, maxPatternSize), s.type, s.inverted);
                break;
            }
            case "spiral": {
                const s = PlayerPatternSettings.getSpiralSettings(player.name);
                positions = PatternEngine.calculateSpiral(center, Math.min(s.radius, maxPatternSize), Math.min(s.height, maxPatternSize * 2), s.stepWidth, s.centerPillar, s.clockwise);
                break;
            }
            case "gable_roof": {
                const s = PlayerPatternSettings.getGableRoofSettings(player.name);
                positions = PatternEngine.calculateGableRoof(center, player, Math.min(s.width, maxPatternSize * 2), Math.min(s.length, maxPatternSize * 2), s.type, s.closeGables);
                break;
            }
            case "torus": {
                const s = PlayerPatternSettings.getTorusSettings(player.name);
                const majorR = Math.min(s.majorRadius, maxPatternSize);
                const tubeR = Math.min(s.tubeRadius, Math.max(1, Math.floor(majorR / 2)));
                positions = PatternEngine.calculateTorus(center, majorR, tubeR, s.axis, s.hollow);
                break;
            }
            case "overlay": {
                const hit = this.getBlockFromView(player, staff.typeId);
                const ovCenter = hit?.block ? hit.block.location : center;
                const s = PlayerPatternSettings.getOverlaySettings(player.name);
                positions = PatternEngine.calculateTerrainOverlay(ovCenter, player.dimension, Math.min(s.radius, maxPatternSize), s.thickness, s.mode);
                break;
            }
        }
        if (pattern !== "overlay") {
            const mirrorSettings = PlayerPatternSettings.getMirrorSettings(player.name);
            const repeatSettings = PlayerPatternSettings.getRepeatSettings(player.name);
            if (mirrorSettings.enabled) {
                const mirrorCenter = (mirrorSettings.useWorldAnchor && mirrorSettings.worldAnchor)
                    ? mirrorSettings.worldAnchor
                    : center;
                positions = PatternEngine.applyMirror(positions, mirrorCenter, mirrorSettings.axis);
            }
            if (repeatSettings.enabled) {
                const direction = PatternEngine.getSnapDirection(player);
                positions = PatternEngine.applyRepeat(positions, repeatSettings.count, repeatSettings.spacing, direction);
            }
        }
        this.placeExactPositions(player, staff, positions, {
            pattern,
            center,
            stairsDir: PlayerPatternSettings.getStairsSettings(player.name).direction,
            inverted: PlayerPatternSettings.getPyramidSettings(player.name).inverted,
            clockwise: PlayerPatternSettings.getSpiralSettings(player.name).clockwise
        });
    }
    static placeStraightLine(player, staff) {
        const settings = PlayerPatternSettings.getLineSettings(player.name);
        const maxCount = StaffConfig.maxBlocks[staff.typeId] || 20;
        const count = Math.min(settings.maxLength, maxCount);
        const dir = PatternEngine.getSnappedLineDirection(player, settings.snap ?? "free");
        const startPos = player.getHeadLocation();
        const positions = [];
        const seen = new Set();
        for (let i = 1; i <= count; i++) {
            const pos = {
                x: Math.floor(startPos.x + dir.x * i),
                y: Math.floor(startPos.y + dir.y * i),
                z: Math.floor(startPos.z + dir.z * i)
            };
            const key = VectorUtils.getPositionKey(pos);
            if (!seen.has(key)) {
                seen.add(key);
                positions.push(pos);
            }
        }
        this.placeExactPositions(player, staff, positions, {
            pattern: "line",
            center: startPos,
            lineDir: dir
        });
    }
    static placeConnectedBlocks(player, target, face, staff) {
        const isRandomizer = PlayerPatternSettings.isRandomizerActive(player.name);
        const selected = BlockSelectionManager.getSelection(player.name);
        if (!selected && !isRandomizer)
            return;
        const surfaceType = isRandomizer ? target.typeId : selected.blockType;
        const settings = PlayerPatternSettings.getConnectedSettings(player.name);
        const maxCount = StaffConfig.maxBlocks[staff.typeId] || 20;
        const actualMax = Math.min(settings.maxBlocks, maxCount);
        const faceOffset = VectorUtils.getFaceOffset(face);
        const facing = PatternEngine.getPlayerFacing(player);
        const connectedPositions = BlockUtils.findSurfaceConnectedBlocks(target, surfaceType, face, actualMax, settings.directionLock, facing).map(pos => VectorUtils.add(pos, faceOffset));
        this.placeExactPositions(player, staff, connectedPositions, {
            pattern: "connected",
            center: target.location
        });
    }
    static destroySelectedBlocks(player, staff) {
        const selected = BlockSelectionManager.getSelection(player.name);
        if (!selected) {
            MessageUtils.sendErrorMessage(player, "Nenhum bloco selecionado para destruição.");
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
            return;
        }
        const blockType = selected.blockType;
        const matchSimilar = PlayerPatternSettings.isMatchSimilarBlocks(player.name);
        const lockedFace = HoloPreviewEngine.overlayLocks.get(player.name)?.target.face;
        HoloPreviewEngine.clearAllPreviews(player);
        const targetBlockFromView = this.getBlockFromView(player, staff.typeId);
        const isCreative = player.getGameMode() === GameMode.creative;
        const targetMatches = targetBlockFromView?.block
            ? (matchSimilar ? BlockUtils.areSimilarBlocks(blockType, targetBlockFromView.block.typeId) : targetBlockFromView.block.typeId === blockType)
            : false;
        if (!targetBlockFromView?.block || !targetMatches) {
            MessageUtils.sendErrorMessage(player, "Você precisa olhar para o tipo de bloco selecionado para destruir.");
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
            return;
        }
        const targetBlock = targetBlockFromView.block;
        const settings = PlayerPatternSettings.getConnectedSettings(player.name);
        const maxCount = Math.min(settings.maxBlocks, StaffConfig.maxBlocks[staff.typeId] || 20);
        const face = lockedFace ?? targetBlockFromView.face;
        const facing = PatternEngine.getPlayerFacing(player);
        const connectedPositions = BlockUtils.findSurfaceConnectedBlocks(targetBlock, blockType, face, maxCount, settings.directionLock, facing, matchSimilar);
        this.executeDestruction(player, staff, connectedPositions, blockType, isCreative, matchSimilar);
    }
    static destroyAreaBlocks(player, staff) {
        const selected = BlockSelectionManager.getSelection(player.name);
        if (!selected) {
            MessageUtils.sendErrorMessage(player, "Nenhum bloco selecionado para destruição.");
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
            return;
        }
        const matchSimilar = PlayerPatternSettings.isMatchSimilarBlocks(player.name);
        HoloPreviewEngine.clearAllPreviews(player);
        const targetBlockFromView = this.getBlockFromView(player, staff.typeId);
        const isCreative = player.getGameMode() === GameMode.creative;
        const targetMatches = targetBlockFromView?.block
            ? (matchSimilar ? BlockUtils.areSimilarBlocks(selected.blockType, targetBlockFromView.block.typeId) : targetBlockFromView.block.typeId === selected.blockType)
            : false;
        if (!targetBlockFromView?.block || !targetMatches) {
            MessageUtils.sendErrorMessage(player, "Você precisa olhar para o tipo de bloco selecionado para destruir.");
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
            return;
        }
        const settings = PlayerPatternSettings.getAreaDestroySettings(player.name);
        const maxRadius = StaffConfig.maxReplaceArea[staff.typeId] || 3;
        const radius = Math.min(settings.radius, maxRadius);
        const allPositions = PatternEngine.calculateAreaDestroy(targetBlockFromView.block.location, radius);
        const validPositions = HoloPreviewEngine.filterDestroyableMatches(player, allPositions, selected.blockType, matchSimilar);
        this.executeDestruction(player, staff, validPositions, selected.blockType, isCreative, matchSimilar, "area");
    }
    static destroyTunnelBlocks(player, staff) {
        const selected = BlockSelectionManager.getSelection(player.name);
        if (!selected) {
            MessageUtils.sendErrorMessage(player, "Nenhum bloco selecionado para escavação.");
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
            return;
        }
        const matchSimilar = PlayerPatternSettings.isMatchSimilarBlocks(player.name);
        HoloPreviewEngine.clearAllPreviews(player);
        const targetBlockFromView = this.getBlockFromView(player, staff.typeId);
        const isCreative = player.getGameMode() === GameMode.creative;
        const targetMatches = targetBlockFromView?.block
            ? (matchSimilar ? BlockUtils.areSimilarBlocks(selected.blockType, targetBlockFromView.block.typeId) : targetBlockFromView.block.typeId === selected.blockType)
            : false;
        if (!targetBlockFromView?.block || !targetMatches) {
            MessageUtils.sendErrorMessage(player, "Você precisa olhar para o bloco selecionado para escavar o túnel.");
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
            return;
        }
        const settings = PlayerPatternSettings.getTunnelDestroySettings(player.name);
        const maxArea = StaffConfig.maxReplaceArea[staff.typeId] || 3;
        const width = Math.min(settings.width, maxArea);
        const height = Math.min(settings.height, maxArea);
        const depth = Math.min(settings.depth, maxArea * 2);
        const allPositions = PatternEngine.calculateTunnel(targetBlockFromView.block.location, player, width, height, depth);
        const validPositions = HoloPreviewEngine.filterDestroyableMatches(player, allPositions, selected.blockType, matchSimilar);
        this.executeDestruction(player, staff, validPositions, selected.blockType, isCreative, matchSimilar, "tunnel");
    }
    static isFragileBlock(typeId) {
        const id = typeId.replace("minecraft:", "");
        return id === "short_grass" || id === "tallgrass" || id === "fern" ||
            id === "large_fern" || id === "double_plant" || id === "dead_bush" ||
            id.endsWith("_sapling") || id === "bamboo" || id === "bamboo_sapling" ||
            id === "sugar_cane" || id === "cactus" || id === "snow_layer" ||
            id.includes("flower") || id === "wither_rose" || id === "dandelion" ||
            id === "poppy" || id.includes("mushroom") ||
            id.includes("_torch") || id === "torch";
    }
    static executeDestruction(player, staff, positions, blockType, isCreative, matchSimilar = false, destructionPattern = "connected") {
        let destroyedCount = 0;
        const destroyedPositions = [];
        const undoEntries = [];
        const dropTotals = new Map();
        const airPermutation = BlockPermutation.resolve("minecraft:air");
        const posSet = new Set(positions.map(p => `${p.x},${p.y},${p.z}`));
        for (const pos of positions) {
            for (let dy = 1; dy <= 2; dy++) {
                const abovePos = { x: pos.x, y: pos.y + dy, z: pos.z };
                if (posSet.has(`${abovePos.x},${abovePos.y},${abovePos.z}`))
                    continue;
                try {
                    const above = player.dimension.getBlock(abovePos);
                    if (above && !above.isAir && !above.isLiquid && this.isFragileBlock(above.typeId)) {
                        above.setType("minecraft:air");
                    }
                }
                catch { }
            }
        }
        for (const pos of positions) {
            const block = player.dimension.getBlock(pos);
            if (!block)
                continue;
            const matches = matchSimilar
                ? BlockUtils.areSimilarBlocks(blockType, block.typeId)
                : block.typeId === blockType;
            if (!matches)
                continue;
            if (BlockUtils.hasContainerOrComplexData(block))
                continue;
            if (!isCreative && this.isBlockUndestroyable(block.typeId))
                continue;
            try {
                const actualType = block.typeId;
                const dropType = !isCreative ? InventoryUtils.getSurvivalDropType(actualType) : null;
                const oldPermutation = block.permutation;
                block.setType("minecraft:air");
                undoEntries.push(UndoEngine.createEntry(player, pos, oldPermutation, airPermutation, undefined, dropType ?? undefined));
                if (dropType) {
                    dropTotals.set(dropType, (dropTotals.get(dropType) ?? 0) + 1);
                }
                destroyedPositions.push(pos);
                destroyedCount++;
                if (destroyedCount % 5 === 0) {
                    player.playSound(this.SOUNDS.destroy, { pitch: 0.9 + Math.random() * 0.2, volume: 0.2 });
                }
            }
            catch (e) {
                console.error(`Failed to destroy block at ${pos.x},${pos.y},${pos.z}: ${e}`);
            }
        }
        if (destroyedCount > 0) {
            if (!isCreative) {
                for (const [itemType, count] of dropTotals.entries()) {
                    InventoryUtils.giveItemsOrDrop(player, itemType, count);
                }
                player.playSound(this.SOUNDS.getItem, { pitch: 1.0, volume: 0.2 });
            }
            if (destructionPattern === "tunnel" || destructionPattern === "area" || destructionPattern === "box2p") {
                this.applyAutoTorches(player, destroyedPositions, undoEntries, isCreative, "tunnel");
            }
            InventoryUtils.reduceDurability(staff, 1, player, "destruction");
            PlayerPatternSettings.recordStats(player, "destroyed", destroyedCount);
            PlayerUtils.updatePlayerHotbarMessage(player);
            UndoEngine.recordOperation(player, undoEntries);
            MessageUtils.sendSuccessMessage(player, `${destroyedCount} blocos destruídos!`);
            player.playSound(this.SOUNDS.success, { pitch: 1.2, volume: 0.2 });
        }
        else {
            PlayerUtils.updatePlayerHotbarMessage(player);
            MessageUtils.sendErrorMessage(player, "Nenhum bloco foi destruído.");
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 0.2 });
        }
    }
    static tryPlaceBlock(dimension, pos, permutation) {
        try {
            const block = dimension.getBlock(pos);
            if (!block)
                return null;
            const canPlace = block.typeId === "minecraft:air" ||
                HoloPreviewEngine.isPreviewBlock(block.typeId) ||
                block.isLiquid ||
                ["minecraft:water", "minecraft:flowing_water",
                    "minecraft:lava", "minecraft:flowing_lava"].includes(block.typeId);
            if (!canPlace)
                return null;
            const oldPermutation = HoloPreviewEngine.isPreviewBlock(block.typeId)
                ? BlockPermutation.resolve("minecraft:air")
                : block.permutation;
            block.setPermutation(permutation);
            return { oldPermutation, newPermutation: permutation };
        }
        catch (error) {
            console.warn(`Failed to place block at ${pos.x},${pos.y},${pos.z}: ${error}`);
            return null;
        }
    }
    static tryPlaceBlockByType(dimension, pos, blockTypeId) {
        try {
            const permutation = BlockPermutation.resolve(blockTypeId);
            return this.tryPlaceBlock(dimension, pos, permutation);
        }
        catch {
            return null;
        }
    }
    static preparePlacement(player, staff) {
        HoloPreviewEngine.clearAllPreviews(player);
        const maxPal = StaffConfig.getMaxPaletteSize(staff.typeId);
        const isRandomizer = PlayerPatternSettings.isRandomizerActive(player.name);
        const selected = BlockSelectionManager.getSelection(player.name);
        const isCreative = player.getGameMode() === GameMode.creative;
        if (isRandomizer) {
            const palette = PlayerPatternSettings.getPalette(player.name, maxPal);
            if (palette.length === 0) {
                MessageUtils.sendErrorMessage(player, "A paleta está vazia. Adicione blocos primeiro.");
                player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
                return null;
            }
            if (!isCreative) {
                const totalPaletteItems = palette.reduce((sum, bt) => sum + InventoryUtils.countItemsInInventory(player, bt), 0);
                if (totalPaletteItems <= 0) {
                    MessageUtils.sendErrorMessage(player, "Você não possui nenhum bloco da paleta no inventário.");
                    player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
                    return null;
                }
            }
            return { blockType: "", permutation: null, available: isCreative ? 999999 : 1, isCreative, isRandomizer: true };
        }
        if (!selected)
            return null;
        const blockType = selected.blockType;
        const permutation = selected.permutation;
        const available = isCreative ? 999999 : InventoryUtils.countItemsInInventory(player, blockType);
        if (available <= 0 && !isCreative) {
            MessageUtils.sendErrorMessage(player, `Você não tem ${BlockUtils.getReadableBlockName(blockType)} no inventário.`);
            player.playSound(this.SOUNDS.error, { pitch: 0.8, volume: 1.0 });
            return null;
        }
        return { blockType, permutation, available, isCreative, isRandomizer: false };
    }
    static finalizePlacement(player, staff, blockType, placed, isCreative, skipInventoryRemoval = false) {
        if (placed > 0) {
            if (!isCreative && !skipInventoryRemoval && blockType) {
                InventoryUtils.removeItemsFromInventory(player, blockType, placed);
            }
            InventoryUtils.reduceDurability(staff, 1, player, "construction");
            PlayerPatternSettings.recordStats(player, "built", placed);
            PlayerUtils.updatePlayerHotbarMessage(player);
            MessageUtils.sendSuccessMessage(player, `${placed} blocos colocados!`);
            player.playSound(this.SOUNDS.success, { pitch: 1.1, volume: 0.7 });
        }
    }
    static isBlockUndestroyable(blockTypeId) {
        if (blockTypeId.startsWith("minecraft:light_block"))
            return true;
        return this.UNDESTROYABLE_BLOCKS.has(blockTypeId);
    }
}
StaffEngine.SOUNDS = {
    selection: "random.orb",
    place: "random.pop",
    error: "note.bass",
    success: "random.levelup",
    destroy: "dig.stone",
    getItem: "random.pop"
};
StaffEngine.UNDESTROYABLE_BLOCKS = new Set([
    "minecraft:bedrock", "minecraft:command_block", "minecraft:repeating_command_block",
    "minecraft:chain_command_block", "minecraft:structure_block", "minecraft:structure_void",
    "minecraft:barrier", "minecraft:end_portal", "minecraft:end_portal_frame",
    "minecraft:end_gateway", "minecraft:portal", "minecraft:nether_portal",
    "minecraft:deny", "minecraft:allow", "minecraft:border_block", "minecraft:jigsaw",
    "minecraft:mob_spawner", "minecraft:trial_spawner", "minecraft:vault",
    "minecraft:reinforced_deepslate", "minecraft:budding_amethyst", "minecraft:light_block"
]);
StaffEngine.MAX_PATTERN_BLOCKS = 2500;
StaffEngine.ASYNC_BATCH_SIZE = 80;
StaffEngine.placementQueues = new Map();
StaffEngine.quickPickCooldowns = new Map();
