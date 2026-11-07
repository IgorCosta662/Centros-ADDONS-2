import { world, system } from "@minecraft/server";
import { StaffConfig } from "../config/staffConfig";
import { BlockSelectionManager } from "../api/models/blockSelection";
import { PlayerPatternSettings } from "../api/models/playerPatternSettings";
import { InventoryUtils } from "../api/inventoryUtils";
import { VectorUtils } from "../api/vectorUtils";
import { BlockUtils } from "../api/blockUtils";
import { PatternEngine } from "./patternEngine";
import { ReplaceEngine } from "./replaceEngine";
import { RegionEngine } from "./regionEngine";
import { BlueprintEngine } from "./blueprintEngine";
export class HoloPreviewEngine {
    static isPreviewBlock(typeId) {
        return typeId === this.PREVIEW_CONSTRUCTION ||
            typeId === this.PREVIEW_DESTRUCTION ||
            typeId === this.PREVIEW_REPLACE ||
            typeId === "arc_st:holo_base";
    }
    static initialize() {
        system.runInterval(() => {
            world.getAllPlayers().forEach(player => this.updatePlayer(player));
        }, this.UPDATE_INTERVAL);
        world.beforeEvents.playerLeave.subscribe((event) => {
            const playerName = event.player.name;
            system.run(() => {
                this.frozenPreviews.delete(playerName);
                this.clearAllPreviewsByName(playerName);
            });
        });
        world.afterEvents.entityDie.subscribe((event) => {
            if (event.deadEntity.typeId === "minecraft:player") {
                const name = event.deadEntity.name;
                this.frozenPreviews.delete(name);
                this.clearAllPreviewsByName(name);
            }
        });
        world.afterEvents.playerDimensionChange.subscribe((event) => {
            this.frozenPreviews.delete(event.player.name);
            this.clearAllPreviewsByName(event.player.name);
        });
    }
    static toggleFreezePreview(player) {
        if (this.frozenPreviews.has(player.name)) {
            this.frozenPreviews.delete(player.name);
            this.clearAllPreviews(player);
            return { frozen: false, count: 0 };
        }
        const current = this.previews.get(player.name) ?? [];
        if (current.length === 0) {
            return { frozen: false, count: 0 };
        }
        const mode = PlayerPatternSettings.getMode(player.name);
        const pattern = this.getCurrentPattern(player.name, mode);
        const heldItem = InventoryUtils.getHeldItem(player);
        const maxDist = heldItem ? StaffConfig.getViewDistance(heldItem.typeId) : 64;
        const blueprintAnchor = mode === "blueprint" && BlueprintEngine.hasActiveBlueprint(player.name)
            ? VectorUtils.getSurfacePlacementCenter(player, maxDist)
            : undefined;
        this.frozenPreviews.set(player.name, {
            positions: current.map(p => ({ ...p })),
            mode,
            pattern,
            dimensionId: player.dimension.id,
            blueprintAnchor
        });
        return { frozen: true, count: current.length };
    }
    static isPreviewFrozen(playerName) {
        return this.frozenPreviews.has(playerName);
    }
    static consumeFrozenPositions(playerName) {
        const data = this.frozenPreviews.get(playerName);
        if (!data)
            return null;
        this.frozenPreviews.delete(playerName);
        return data.positions;
    }
    static consumeFrozenBlueprintAnchor(playerName) {
        const data = this.frozenPreviews.get(playerName);
        if (!data)
            return null;
        this.frozenPreviews.delete(playerName);
        return data.blueprintAnchor ?? null;
    }
    static unfreezePreview(playerName) {
        this.frozenPreviews.delete(playerName);
    }
    static updatePlayer(player) {
        const heldItem = InventoryUtils.getHeldItem(player);
        const heldId = heldItem?.typeId ?? "";
        if (!StaffConfig.isStaff(heldId)) {
            this.frozenPreviews.delete(player.name);
            this.clearAllPreviews(player);
            return;
        }
        const mode = PlayerPatternSettings.getMode(player.name);
        const previewStyle = PlayerPatternSettings.getPreviewStyle(player.name);
        const pattern = this.getCurrentPattern(player.name, mode);
        const frozen = this.frozenPreviews.get(player.name);
        if (frozen) {
            if (frozen.mode !== mode || frozen.pattern !== pattern || frozen.dimensionId !== player.dimension.id) {
                this.frozenPreviews.delete(player.name);
                this.clearAllPreviews(player);
            }
            else {
                this.renderFrozenPreview(player, frozen, previewStyle);
                return;
            }
        }
        const selection = BlockSelectionManager.getSelection(player.name);
        const maxPal = StaffConfig.getMaxPaletteSize(heldId);
        const isRandomizerActive = mode === "construction" && PlayerPatternSettings.isRandomizerActive(player.name);
        const isRandomizerPending = isRandomizerActive && PlayerPatternSettings.isRandomizerPending(player.name);
        const isRandomizerReady = isRandomizerActive && !isRandomizerPending && PlayerPatternSettings.getPalette(player.name, maxPal).length > 0;
        const isFoliageMode = mode === "destruction" && pattern === "foliage";
        const isBlueprintMode = mode === "blueprint";
        if (isRandomizerActive && !isRandomizerReady) {
            this.clearAllPreviews(player);
            return;
        }
        if (isBlueprintMode) {
            const canPreviewBp = BlueprintEngine.getCopyPos1(player.name, player.dimension.id) !== null ||
                BlueprintEngine.hasActiveBlueprint(player.name);
            if (!canPreviewBp) {
                this.clearAllPreviews(player);
                return;
            }
        }
        else if (!selection && !isRandomizerReady && mode !== "replace" && !isFoliageMode) {
            this.clearAllPreviews(player);
            return;
        }
        if (mode === "construction" && !StaffConfig.canUsePattern(heldId, pattern)) {
            this.clearAllPreviews(player);
            return;
        }
        const maxDist = StaffConfig.getViewDistance(heldId);
        const newState = this.buildPlayerState(player, heldId, mode, pattern, previewStyle, maxDist);
        const oldState = this.states.get(player.name);
        if (this.shouldClearPreviews(oldState, newState)) {
            this.clearAllPreviews(player);
        }
        this.states.set(player.name, newState);
        try {
            if (previewStyle === "particles") {
                this.handleParticlePreview(player, selection ?? null, newState, mode, pattern, maxDist);
            }
            else if (mode === "replace") {
                this.handleReplacePreview(player, newState, maxDist);
            }
            else if (mode === "destruction") {
                this.handleDestructionPreview(player, selection ?? null, newState, pattern, maxDist);
            }
            else if (mode === "blueprint") {
                this.handleBlueprintBlockPreview(player, maxDist);
            }
            else {
                this.handleConstructionPreview(player, selection ?? null, newState, pattern, maxDist);
            }
        }
        catch {
            this.clearAllPreviews(player);
        }
    }
    static renderFrozenPreview(player, frozen, previewStyle) {
        this.previews.set(player.name, frozen.positions);
        if (previewStyle === "particles") {
            const particleId = frozen.mode === "destruction"
                ? this.PARTICLE_DESTRUCTION
                : frozen.mode === "replace"
                    ? this.PARTICLE_REPLACE
                    : this.PARTICLE_CONSTRUCTION;
            const renderPositions = frozen.positions.length > this.MAX_PARTICLE_BLOCKS
                ? PatternEngine.optimizeForPreview(frozen.positions, this.MAX_PARTICLE_BLOCKS)
                : frozen.positions;
            for (const pos of renderPositions) {
                try {
                    player.dimension.spawnParticle(particleId, { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 });
                }
                catch { }
            }
        }
        else if (frozen.mode === "construction" || frozen.mode === "blueprint") {
            this.setBlockPreviewBlocks(player, frozen.positions, this.PREVIEW_CONSTRUCTION);
        }
    }
    static handleBlueprintBlockPreview(player, maxDist) {
        const positions = BlueprintEngine.computePreviewPositions(player, maxDist, (pos) => {
            try {
                const block = player.dimension.getBlock(pos);
                return block ? this.canPlacePreviewAt(block) : false;
            }
            catch {
                return false;
            }
        });
        if (!positions?.length) {
            this.clearBlockPreview(player);
            return;
        }
        this.setBlockPreviewBlocks(player, positions, this.PREVIEW_CONSTRUCTION);
    }
    static handleParticlePreview(player, selection, state, mode, pattern, maxDist) {
        let positions = null;
        let particleId = this.PARTICLE_CONSTRUCTION;
        if (mode === "replace") {
            particleId = this.PARTICLE_REPLACE;
            const targetBlockFromView = player.getBlockFromViewDirection({
                maxDistance: maxDist,
                includeLiquidBlocks: true,
                includePassableBlocks: false
            });
            const realTarget = targetBlockFromView?.block ?? null;
            if (realTarget && !this.isPreviewBlock(realTarget.typeId)) {
                positions = ReplaceEngine.getReplacePreview(player, realTarget);
            }
        }
        else if (mode === "destruction") {
            particleId = this.PARTICLE_DESTRUCTION;
            if (selection || pattern === "foliage") {
                positions = this.computeDestructionPreview(player, selection, state, pattern, maxDist);
            }
        }
        else if (mode === "blueprint") {
            particleId = BlueprintEngine.getCopyPos1(player.name, player.dimension.id)
                ? this.PARTICLE_REPLACE
                : this.PARTICLE_CONSTRUCTION;
            positions = BlueprintEngine.computePreviewPositions(player, maxDist, (pos) => {
                try {
                    const block = player.dimension.getBlock(pos);
                    return block ? this.canPlacePreviewAt(block) : false;
                }
                catch {
                    return false;
                }
            });
        }
        else {
            particleId = this.PARTICLE_CONSTRUCTION;
            positions = this.computeConstructionPreview(player, selection, state, pattern, maxDist);
        }
        if (!positions || positions.length === 0) {
            this.previews.set(player.name, []);
            return;
        }
        this.previews.set(player.name, positions);
        const renderPositions = positions.length > this.MAX_PARTICLE_BLOCKS
            ? PatternEngine.optimizeForPreview(positions, this.MAX_PARTICLE_BLOCKS)
            : positions;
        for (const pos of renderPositions) {
            try {
                player.dimension.spawnParticle(particleId, {
                    x: pos.x + 0.5,
                    y: pos.y + 0.5,
                    z: pos.z + 0.5
                });
            }
            catch { }
        }
    }
    static getCurrentPattern(playerName, mode) {
        if (mode === "construction")
            return PlayerPatternSettings.getConstructionPattern(playerName);
        if (mode === "destruction")
            return PlayerPatternSettings.getDestructionPattern(playerName);
        if (mode === "replace")
            return PlayerPatternSettings.getReplaceMode(playerName);
        if (mode === "blueprint")
            return "blueprint";
        return "line";
    }
    static buildPlayerState(player, heldId, mode, pattern, previewStyle, maxDist) {
        return {
            heldItemId: StaffConfig.getBaseStaffId(heldId),
            isSneaking: player.isSneaking,
            position: this.roundVector(player.location),
            viewDir: this.roundVector(player.getViewDirection()),
            targetBlock: this.getTargetInfo(player, maxDist),
            mode,
            pattern,
            previewStyle,
            dimensionId: player.dimension.id
        };
    }
    static shouldClearPreviews(oldState, newState) {
        if (!oldState)
            return true;
        if (oldState.heldItemId !== newState.heldItemId ||
            oldState.mode !== newState.mode ||
            oldState.pattern !== newState.pattern ||
            oldState.previewStyle !== newState.previewStyle ||
            oldState.dimensionId !== newState.dimensionId)
            return true;
        if (newState.previewStyle === "particles")
            return false;
        if (newState.mode === "destruction" || newState.mode === "replace")
            return false;
        return this.stateChanged(oldState, newState);
    }
    static handleReplacePreview(player, state, maxDist) {
        const playerName = player.name;
        const hasPreview = (this.previews.get(playerName)?.length ?? 0) > 0;
        const lock = this.overlayLocks.get(playerName) ?? null;
        const targetBlockFromView = player.getBlockFromViewDirection({
            maxDistance: maxDist,
            includeLiquidBlocks: true,
            includePassableBlocks: false
        });
        const rawTarget = targetBlockFromView?.block ?? null;
        const realTarget = (rawTarget && !this.isPreviewBlock(rawTarget.typeId)) ? rawTarget : null;
        if (hasPreview && lock) {
            if (realTarget) {
                if (realTarget.typeId === lock.target.id &&
                    this.vectorEquals(realTarget.location, lock.target.location)) {
                    return;
                }
                if (this.isTargetBehindPreview(player, realTarget.location)) {
                    return;
                }
                this.clearBlockPreview(player);
            }
            else {
                if (!this.hasMovedAway(state, lock))
                    return;
                this.clearBlockPreview(player);
            }
        }
        if (!realTarget)
            return;
        const positions = ReplaceEngine.getReplacePreview(player, realTarget);
        if (!positions?.length) {
            this.clearBlockPreview(player);
            return;
        }
        this.setOverlayPreviewBlocks(player, positions, this.PREVIEW_REPLACE);
        this.overlayLocks.set(playerName, {
            target: { id: realTarget.typeId, location: { ...realTarget.location }, face: targetBlockFromView?.face ?? "Down" },
            viewDir: { ...state.viewDir },
            position: { ...state.position }
        });
    }
    static handleDestructionPreview(player, selection, state, pattern, maxDist) {
        const playerName = player.name;
        const hasPreview = (this.previews.get(playerName)?.length ?? 0) > 0;
        const { targetBlock } = state;
        const lock = this.overlayLocks.get(playerName) ?? null;
        const matchSimilar = PlayerPatternSettings.isMatchSimilarBlocks(playerName);
        if (pattern === "foliage" || pattern === "box2p") {
            const positions = this.computeDestructionPreview(player, selection, state, pattern, maxDist);
            if (!positions || positions.length === 0) {
                this.clearBlockPreview(player);
                return;
            }
            this.setOverlayPreviewBlocks(player, positions, this.PREVIEW_DESTRUCTION);
            return;
        }
        if (!selection) {
            this.clearBlockPreview(player);
            return;
        }
        if (hasPreview && lock) {
            if (targetBlock) {
                if (this.targetEquals(targetBlock, lock.target)) {
                    return;
                }
                if (this.isTargetBehindPreview(player, targetBlock.location)) {
                    return;
                }
                this.clearBlockPreview(player);
            }
            else {
                if (!this.hasMovedAway(state, lock))
                    return;
                this.clearBlockPreview(player);
            }
        }
        if (!targetBlock)
            return;
        const target = player.dimension.getBlock(targetBlock.location);
        const matches = target
            ? (matchSimilar ? BlockUtils.areSimilarBlocks(selection.blockType, target.typeId) : target.typeId === selection.blockType)
            : false;
        if (!target || !matches) {
            this.clearBlockPreview(player);
            return;
        }
        const positions = this.computeDestructionPreview(player, selection, state, pattern, maxDist);
        if (!positions || positions.length === 0) {
            this.clearBlockPreview(player);
            return;
        }
        this.setOverlayPreviewBlocks(player, positions, this.PREVIEW_DESTRUCTION);
        this.overlayLocks.set(playerName, {
            target: { ...targetBlock, location: { ...targetBlock.location } },
            viewDir: { ...state.viewDir },
            position: { ...state.position }
        });
    }
    static handleConstructionPreview(player, selection, state, pattern, maxDist) {
        const positions = this.computeConstructionPreview(player, selection, state, pattern, maxDist);
        if (!positions?.length) {
            this.clearBlockPreview(player);
            return;
        }
        this.setBlockPreviewBlocks(player, positions, this.PREVIEW_CONSTRUCTION);
    }
    static computeConstructionPreview(player, selection, state, pattern, maxDist) {
        const { targetBlock } = state;
        const maxPatternSize = this.getMaxPatternSize(player);
        switch (pattern) {
            case "line":
                return this.computeLinePreview(player);
            case "connected":
                if (targetBlock) {
                    const target = player.dimension.getBlock(targetBlock.location);
                    if (!target || this.isPreviewBlock(target.typeId))
                        return null;
                    const isRandomizer = PlayerPatternSettings.isRandomizerActive(player.name);
                    if ((selection && target.typeId === selection.blockType) || isRandomizer) {
                        return this.computeConnectedPreview(player, target, targetBlock.face);
                    }
                }
                break;
            case "floor": {
                const settings = PlayerPatternSettings.getFloorSettings(player.name);
                const center = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                const width = Math.min(settings.width, maxPatternSize);
                const length = Math.min(settings.length, maxPatternSize);
                const positions = PatternEngine.calculateFloor(center, player, width, length, settings.filled);
                return this.applyModifiers(player, positions, center);
            }
            case "stairs": {
                const settings = PlayerPatternSettings.getStairsSettings(player.name);
                const center = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                const width = Math.min(settings.width, maxPatternSize);
                const steps = Math.min(settings.steps, maxPatternSize * 2);
                const positions = PatternEngine.calculateStairs(center, player, width, steps, settings.direction);
                return this.applyModifiers(player, positions, center);
            }
            case "arch": {
                const settings = PlayerPatternSettings.getArchSettings(player.name);
                const center = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                const span = Math.min(settings.span, maxPatternSize * 2);
                const height = Math.min(settings.height, maxPatternSize);
                const depth = Math.min(settings.depth, maxPatternSize);
                const positions = PatternEngine.calculateArch(center, player, span, height, depth);
                return this.applyModifiers(player, positions, center);
            }
            case "circle": {
                const settings = PlayerPatternSettings.getCircleSettings(player.name);
                const center = VectorUtils.getRaycastCenter(player, maxDist);
                const radius = Math.min(settings.radius, maxPatternSize);
                const positions = PatternEngine.calculateCircle(center, radius, settings.axis, settings.filled);
                return this.applyModifiers(player, positions, center);
            }
            case "cylinder": {
                const settings = PlayerPatternSettings.getCylinderSettings(player.name);
                const center = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                const radius = Math.min(settings.radius, maxPatternSize);
                const height = Math.min(settings.height, maxPatternSize);
                const positions = PatternEngine.calculateCylinder(center, radius, height, settings.type);
                return this.applyModifiers(player, positions, center);
            }
            case "sphere": {
                const settings = PlayerPatternSettings.getSphereSettings(player.name);
                const center = VectorUtils.getRaycastCenter(player, maxDist);
                const radius = Math.min(settings.radius, maxPatternSize);
                const positions = PatternEngine.calculateSphere(center, radius, settings.type);
                return this.applyModifiers(player, positions, center);
            }
            case "dome": {
                const settings = PlayerPatternSettings.getDomeSettings(player.name);
                const center = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                const radius = Math.min(settings.radius, maxPatternSize);
                const positions = PatternEngine.calculateDome(center, radius, settings.type, settings.inverted);
                return this.applyModifiers(player, positions, center);
            }
            case "wall": {
                const settings = PlayerPatternSettings.getWallSettings(player.name);
                const center = VectorUtils.getRaycastCenter(player, maxDist);
                const width = Math.min(settings.width, maxPatternSize);
                const height = Math.min(settings.height, maxPatternSize);
                const positions = PatternEngine.calculateWall(center, player, width, height, settings.thickness);
                return this.applyModifiers(player, positions, center);
            }
            case "cube": {
                const settings = PlayerPatternSettings.getCubeSettings(player.name);
                const center = VectorUtils.getRaycastCenter(player, maxDist);
                const size = Math.min(settings.size, maxPatternSize);
                const positions = PatternEngine.calculateCube(center, size, settings.type);
                return this.applyModifiers(player, positions, center);
            }
            case "pyramid": {
                const settings = PlayerPatternSettings.getPyramidSettings(player.name);
                const center = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                const size = Math.min(settings.size, maxPatternSize);
                const positions = PatternEngine.calculatePyramid(center, size, settings.type, settings.inverted);
                return this.applyModifiers(player, positions, center);
            }
            case "spiral": {
                const settings = PlayerPatternSettings.getSpiralSettings(player.name);
                const center = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                const radius = Math.min(settings.radius, maxPatternSize);
                const height = Math.min(settings.height, maxPatternSize * 2);
                const positions = PatternEngine.calculateSpiral(center, radius, height, settings.stepWidth, settings.centerPillar, settings.clockwise);
                return this.applyModifiers(player, positions, center);
            }
            case "gable_roof": {
                const settings = PlayerPatternSettings.getGableRoofSettings(player.name);
                const center = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                const width = Math.min(settings.width, maxPatternSize * 2);
                const length = Math.min(settings.length, maxPatternSize * 2);
                const positions = PatternEngine.calculateGableRoof(center, player, width, length, settings.type, settings.closeGables);
                return this.applyModifiers(player, positions, center);
            }
            case "torus": {
                const settings = PlayerPatternSettings.getTorusSettings(player.name);
                const center = VectorUtils.getRaycastCenter(player, maxDist);
                const majorR = Math.min(settings.majorRadius, maxPatternSize);
                const tubeR = Math.min(settings.tubeRadius, Math.max(1, Math.floor(majorR / 2)));
                const positions = PatternEngine.calculateTorus(center, majorR, tubeR, settings.axis, settings.hollow);
                return this.applyModifiers(player, positions, center);
            }
            case "box2p": {
                const pos1 = RegionEngine.getPos1(player.name, player.dimension.id, "construction");
                if (!pos1)
                    return null;
                const pos2 = VectorUtils.getSurfacePlacementCenter(player, maxDist);
                const settings = PlayerPatternSettings.getBox2PSettings(player.name);
                const heldItem = InventoryUtils.getHeldItem(player);
                const maxVol = StaffConfig.getMaxBox2PVolume(heldItem?.typeId || "");
                const positions = PatternEngine.calculateBox2P(pos1, pos2, settings.fillStyle, maxVol);
                return positions.filter(pos => {
                    try {
                        const block = player.dimension.getBlock(pos);
                        return block ? this.canPlacePreviewAt(block) : false;
                    }
                    catch {
                        return false;
                    }
                });
            }
            case "overlay": {
                const settings = PlayerPatternSettings.getOverlaySettings(player.name);
                const center = targetBlock ? targetBlock.location : VectorUtils.getRaycastCenter(player, maxDist);
                const radius = Math.min(settings.radius, maxPatternSize);
                const positions = PatternEngine.calculateTerrainOverlay(center, player.dimension, radius, settings.thickness, settings.mode);
                return positions.filter(pos => {
                    try {
                        const block = player.dimension.getBlock(pos);
                        return block ? this.canPlacePreviewAt(block) : false;
                    }
                    catch {
                        return false;
                    }
                });
            }
        }
        return null;
    }
    static applyModifiers(player, positions, center) {
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
        return positions.filter(pos => {
            try {
                const block = player.dimension.getBlock(pos);
                return block ? this.canPlacePreviewAt(block) : false;
            }
            catch {
                return false;
            }
        });
    }
    static computeDestructionPreview(player, selection, state, pattern, maxDist = 64) {
        const { targetBlock } = state;
        if (pattern === "foliage") {
            const hit = player.getBlockFromViewDirection({
                maxDistance: maxDist,
                includeLiquidBlocks: false,
                includePassableBlocks: true
            });
            const center = hit?.block ? hit.block.location : (targetBlock ? targetBlock.location : null);
            if (!center)
                return null;
            const settings = PlayerPatternSettings.getFoliageDestroySettings(player.name);
            const maxRadius = Math.max(4, this.getMaxReplaceArea(player) + 3);
            const radius = Math.min(settings.radius, maxRadius);
            return PatternEngine.calculateFoliageClear(center, player.dimension, radius, settings.includeLeaves);
        }
        if (pattern === "box2p") {
            if (!selection)
                return null;
            const pos1 = RegionEngine.getPos1(player.name, player.dimension.id, "destruction");
            if (!pos1 || !targetBlock)
                return null;
            const heldItem = InventoryUtils.getHeldItem(player);
            const maxVol = StaffConfig.getMaxBox2PVolume(heldItem?.typeId || "");
            const matchSim = PlayerPatternSettings.isMatchSimilarBlocks(player.name);
            const boxPositions = PatternEngine.calculateBox2P(pos1, targetBlock.location, "filled", maxVol);
            return this.filterDestroyableMatches(player, boxPositions, selection.blockType, matchSim);
        }
        if (!selection || !targetBlock)
            return null;
        const target = player.dimension.getBlock(targetBlock.location);
        const matchSimilar = PlayerPatternSettings.isMatchSimilarBlocks(player.name);
        const targetMatches = target
            ? (matchSimilar ? BlockUtils.areSimilarBlocks(selection.blockType, target.typeId) : target.typeId === selection.blockType)
            : false;
        if (!target || !targetMatches)
            return null;
        if (pattern === "connected") {
            const connSettings = PlayerPatternSettings.getConnectedSettings(player.name);
            const maxCount = Math.min(connSettings.maxBlocks, this.getMaxBlocks(player));
            const facing = PatternEngine.getPlayerFacing(player);
            return BlockUtils.findSurfaceConnectedBlocks(target, selection.blockType, targetBlock.face, maxCount, connSettings.directionLock, facing, matchSimilar).filter(pos => {
                try {
                    const block = player.dimension.getBlock(pos);
                    return block ? !BlockUtils.hasContainerOrComplexData(block) : false;
                }
                catch {
                    return false;
                }
            });
        }
        else if (pattern === "area") {
            const settings = PlayerPatternSettings.getAreaDestroySettings(player.name);
            const maxRadius = this.getMaxReplaceArea(player);
            const radius = Math.min(settings.radius, maxRadius);
            const allPositions = PatternEngine.calculateAreaDestroy(target.location, radius);
            return this.filterDestroyableMatches(player, allPositions, selection.blockType, matchSimilar);
        }
        else if (pattern === "tunnel") {
            const settings = PlayerPatternSettings.getTunnelDestroySettings(player.name);
            const maxSize = this.getMaxReplaceArea(player);
            const width = Math.min(settings.width, maxSize);
            const height = Math.min(settings.height, maxSize);
            const depth = Math.min(settings.depth, maxSize * 2);
            const allPositions = PatternEngine.calculateTunnel(target.location, player, width, height, depth);
            return this.filterDestroyableMatches(player, allPositions, selection.blockType, matchSimilar);
        }
        return null;
    }
    static filterDestroyableMatches(player, positions, selectedType, matchSimilar) {
        const valid = [];
        for (const pos of positions) {
            try {
                const block = player.dimension.getBlock(pos);
                if (!block || BlockUtils.hasContainerOrComplexData(block))
                    continue;
                const ok = matchSimilar
                    ? BlockUtils.areSimilarBlocks(selectedType, block.typeId)
                    : block.typeId === selectedType;
                if (ok)
                    valid.push(pos);
            }
            catch { }
        }
        return valid;
    }
    static computeLinePreview(player) {
        const settings = PlayerPatternSettings.getLineSettings(player.name);
        const count = Math.min(settings.maxLength, this.getMaxBlocks(player));
        const start = player.getHeadLocation();
        const dir = PatternEngine.getSnappedLineDirection(player, settings.snap ?? "free");
        const results = [];
        const seen = new Set();
        for (let i = 1; i <= count; i++) {
            const pos = {
                x: Math.floor(start.x + dir.x * i),
                y: Math.floor(start.y + dir.y * i),
                z: Math.floor(start.z + dir.z * i)
            };
            const key = VectorUtils.getPositionKey(pos);
            if (seen.has(key))
                continue;
            seen.add(key);
            const block = player.dimension.getBlock(pos);
            if (block && this.canPlacePreviewAt(block)) {
                results.push(pos);
            }
        }
        return results;
    }
    static computeConnectedPreview(player, target, face) {
        const isRandomizer = PlayerPatternSettings.isRandomizerActive(player.name);
        const selection = BlockSelectionManager.getSelection(player.name);
        if (!selection && !isRandomizer)
            return [];
        const surfaceType = isRandomizer ? target.typeId : selection.blockType;
        const offset = VectorUtils.getFaceOffset(face);
        const settings = PlayerPatternSettings.getConnectedSettings(player.name);
        const maxCount = Math.min(settings.maxBlocks, this.getMaxBlocks(player));
        const facing = PatternEngine.getPlayerFacing(player);
        const connected = BlockUtils.findSurfaceConnectedBlocks(target, surfaceType, face, maxCount, settings.directionLock, facing);
        return connected
            .map(pos => ({ x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z }))
            .filter(pos => {
            try {
                const block = player.dimension.getBlock(pos);
                return block && this.canPlacePreviewAt(block);
            }
            catch {
                return false;
            }
        });
    }
    static canPlacePreviewAt(block) {
        return block.typeId === "minecraft:air" ||
            this.isPreviewBlock(block.typeId) ||
            block.isLiquid ||
            this.LIQUID_BLOCKS.has(block.typeId);
    }
    static isPreviewOwnedByOther(playerName, pos, dimensionId) {
        for (const [otherName, otherPositions] of this.previews.entries()) {
            if (otherName === playerName)
                continue;
            if (this.previewDimensions.get(otherName) !== dimensionId)
                continue;
            if (otherPositions.some(p => this.vectorEquals(p, pos)))
                return true;
        }
        return false;
    }
    static setBlockPreviewBlocks(player, blocks, previewType) {
        const playerName = player.name;
        const dimensionId = player.dimension.id;
        const current = this.previews.get(playerName) || [];
        const currentOriginals = this.originalBlocks.get(playerName) || [];
        if (blocks.length > this.MAX_PREVIEW_BLOCKS) {
            blocks = PatternEngine.optimizeForPreview(blocks, this.MAX_PREVIEW_BLOCKS);
        }
        blocks = blocks.filter(pos => !this.isPreviewOwnedByOther(playerName, pos, dimensionId));
        const toRemove = current.filter(p => !blocks.some(b => this.vectorEquals(p, b)));
        const toAdd = blocks.filter(p => !current.some(b => this.vectorEquals(p, b)));
        this.removePreviewBlocks(player.dimension.id, toRemove, currentOriginals);
        this.addPreviewBlocks(player, toAdd, currentOriginals, previewType);
        this.previews.set(playerName, blocks);
        this.previewDimensions.set(playerName, dimensionId);
        this.originalBlocks.set(playerName, currentOriginals);
    }
    static setOverlayPreviewBlocks(player, blocks, previewType) {
        const playerName = player.name;
        const dimensionId = player.dimension.id;
        const current = this.previews.get(playerName) || [];
        const currentOriginals = this.originalBlocks.get(playerName) || [];
        if (blocks.length > this.MAX_PREVIEW_BLOCKS) {
            blocks = PatternEngine.optimizeForPreview(blocks, this.MAX_PREVIEW_BLOCKS);
        }
        blocks = blocks.filter(pos => !this.isPreviewOwnedByOther(playerName, pos, dimensionId));
        const toRemove = current.filter(p => !blocks.some(b => this.vectorEquals(p, b)));
        const toAdd = blocks.filter(p => !current.some(b => this.vectorEquals(p, b)));
        this.removePreviewBlocks(player.dimension.id, toRemove, currentOriginals);
        const placedPositions = this.addOverlayBlocks(player, toAdd, currentOriginals, previewType);
        const keptCurrent = current.filter(p => blocks.some(b => this.vectorEquals(p, b)));
        this.previews.set(playerName, [...keptCurrent, ...placedPositions]);
        this.previewDimensions.set(playerName, dimensionId);
        this.originalBlocks.set(playerName, currentOriginals);
    }
    static removePreviewBlocks(fallbackDimensionId, positions, originals) {
        for (const pos of positions) {
            const originalIndex = originals.findIndex(orig => this.vectorEquals(orig.location, pos));
            const dimId = originalIndex !== -1 ? originals[originalIndex].dimensionId : fallbackDimensionId;
            try {
                const block = world.getDimension(dimId).getBlock(pos);
                if (!block || !this.isPreviewBlock(block.typeId)) {
                    if (originalIndex !== -1)
                        originals.splice(originalIndex, 1);
                    continue;
                }
                if (originalIndex !== -1) {
                    const original = originals[originalIndex];
                    block.setPermutation(original.permutation);
                    originals.splice(originalIndex, 1);
                }
                else {
                    block.setType("minecraft:air");
                }
            }
            catch {
                if (originalIndex !== -1)
                    originals.splice(originalIndex, 1);
            }
        }
    }
    static addPreviewBlocks(player, positions, originals, previewType) {
        const dimensionId = player.dimension.id;
        for (const pos of positions) {
            try {
                const block = player.dimension.getBlock(pos);
                if (!block || !this.canPlacePreviewAt(block))
                    continue;
                if (!this.isPreviewBlock(block.typeId)) {
                    originals.push({ permutation: block.permutation, location: { ...pos }, dimensionId });
                }
                block.setType(previewType);
            }
            catch { }
        }
    }
    static addOverlayBlocks(player, positions, originals, previewType) {
        const dimensionId = player.dimension.id;
        const placed = [];
        for (const pos of positions) {
            try {
                const block = player.dimension.getBlock(pos);
                if (!block || this.isPreviewBlock(block.typeId) || block.typeId === "minecraft:air")
                    continue;
                if (BlockUtils.hasContainerOrComplexData(block))
                    continue;
                originals.push({ permutation: block.permutation, location: { ...pos }, dimensionId });
                block.setType(previewType);
                placed.push(pos);
            }
            catch { }
        }
        return placed;
    }
    static clearBlockPreviewByName(playerName, fallbackDimensionId) {
        const positions = this.previews.get(playerName) || [];
        const originals = this.originalBlocks.get(playerName) || [];
        if (originals.length > 0 || this.previewDimensions.has(playerName)) {
            const dimId = this.previewDimensions.get(playerName) ?? fallbackDimensionId ?? "minecraft:overworld";
            for (const pos of positions) {
                const original = originals.find(orig => this.vectorEquals(orig.location, pos));
                const targetDimId = original?.dimensionId ?? dimId;
                try {
                    const block = world.getDimension(targetDimId).getBlock(pos);
                    if (!block || !this.isPreviewBlock(block.typeId))
                        continue;
                    if (original) {
                        block.setPermutation(original.permutation);
                    }
                    else {
                        block.setType("minecraft:air");
                    }
                }
                catch { }
            }
        }
        this.previews.set(playerName, []);
        this.originalBlocks.set(playerName, []);
        this.previewDimensions.delete(playerName);
        this.overlayLocks.delete(playerName);
    }
    static clearBlockPreview(player) {
        this.clearBlockPreviewByName(player.name, player.dimension.id);
    }
    static clearAllPreviewsByName(playerName) {
        this.clearBlockPreviewByName(playerName);
        this.states.delete(playerName);
        this.overlayLocks.delete(playerName);
    }
    static clearAllPreviews(player) {
        this.clearBlockPreview(player);
        this.states.delete(player.name);
        this.overlayLocks.delete(player.name);
    }
    static getTargetInfo(player, maxDistance = 64) {
        const view = player.getBlockFromViewDirection({
            maxDistance,
            includeLiquidBlocks: true,
            includePassableBlocks: false
        });
        if (!view?.block)
            return null;
        if (view.block.typeId === "minecraft:air" || this.isPreviewBlock(view.block.typeId))
            return null;
        return { id: view.block.typeId, location: { ...view.block.location }, face: view.face };
    }
    static isTargetBehindPreview(player, targetLocation) {
        const positions = this.previews.get(player.name);
        if (!positions?.length)
            return false;
        const posSet = new Set(positions.map(p => `${p.x},${p.y},${p.z}`));
        const head = player.getHeadLocation();
        const dir = player.getViewDirection();
        const targetDist = Math.sqrt((targetLocation.x - head.x) ** 2 +
            (targetLocation.y - head.y) ** 2 +
            (targetLocation.z - head.z) ** 2);
        for (let t = 0.5; t < targetDist - 0.5; t += 0.5) {
            const key = `${Math.floor(head.x + dir.x * t)},${Math.floor(head.y + dir.y * t)},${Math.floor(head.z + dir.z * t)}`;
            if (posSet.has(key))
                return true;
        }
        return false;
    }
    static hasMovedAway(state, lock) {
        const dx = state.position.x - lock.position.x;
        const dy = state.position.y - lock.position.y;
        const dz = state.position.z - lock.position.z;
        return dx * dx + dy * dy + dz * dz > 4;
    }
    static stateChanged(oldState, newState) {
        return oldState.isSneaking !== newState.isSneaking ||
            !this.vectorEquals(oldState.position, newState.position) ||
            !this.vectorEquals(oldState.viewDir, newState.viewDir) ||
            !this.targetEquals(oldState.targetBlock, newState.targetBlock);
    }
    static roundVector(v) {
        const factor = this.ROUNDING_FACTOR;
        return {
            x: Math.floor(v.x * factor) / factor,
            y: Math.floor(v.y * factor) / factor,
            z: Math.floor(v.z * factor) / factor
        };
    }
    static vectorEquals(a, b) {
        return a.x === b.x && a.y === b.y && a.z === b.z;
    }
    static targetEquals(a, b) {
        if (!a || !b)
            return a === b;
        return a.id === b.id && this.vectorEquals(a.location, b.location) && a.face === b.face;
    }
    static getMaxBlocks(player) {
        const heldItem = InventoryUtils.getHeldItem(player);
        return StaffConfig.maxBlocks[heldItem?.typeId || ""] || 20;
    }
    static getMaxPatternSize(player) {
        const heldItem = InventoryUtils.getHeldItem(player);
        return StaffConfig.maxPatternSize[heldItem?.typeId || ""] || 5;
    }
    static getMaxReplaceArea(player) {
        const heldItem = InventoryUtils.getHeldItem(player);
        return StaffConfig.maxReplaceArea[heldItem?.typeId || ""] || 3;
    }
    static hasBlockPreview(player) {
        return (this.previews.get(player.name)?.length ?? 0) > 0;
    }
    static getPreviewCount(player) {
        return this.previews.get(player.name)?.length ?? 0;
    }
    static getOutlinePositions(positions) {
        if (positions.length === 0)
            return [];
        let minX = positions[0].x, maxX = positions[0].x;
        let minY = positions[0].y, maxY = positions[0].y;
        let minZ = positions[0].z, maxZ = positions[0].z;
        for (const pos of positions) {
            if (pos.x < minX)
                minX = pos.x;
            if (pos.x > maxX)
                maxX = pos.x;
            if (pos.y < minY)
                minY = pos.y;
            if (pos.y > maxY)
                maxY = pos.y;
            if (pos.z < minZ)
                minZ = pos.z;
            if (pos.z > maxZ)
                maxZ = pos.z;
        }
        const outline = [];
        for (const pos of positions) {
            const isOnEdge = pos.x === minX || pos.x === maxX ||
                pos.y === minY || pos.y === maxY ||
                pos.z === minZ || pos.z === maxZ;
            if (isOnEdge)
                outline.push(pos);
        }
        return outline;
    }
}
HoloPreviewEngine.PREVIEW_CONSTRUCTION = "arc_st:holo_build";
HoloPreviewEngine.PREVIEW_DESTRUCTION = "arc_st:holo_break";
HoloPreviewEngine.PREVIEW_REPLACE = "arc_st:holo_swap";
HoloPreviewEngine.PARTICLE_CONSTRUCTION = "arc_st:holo_build.1";
HoloPreviewEngine.PARTICLE_DESTRUCTION = "arc_st:holo_break.1";
HoloPreviewEngine.PARTICLE_REPLACE = "arc_st:holo_swap.1";
HoloPreviewEngine.UPDATE_INTERVAL = 4;
HoloPreviewEngine.ROUNDING_FACTOR = 10;
HoloPreviewEngine.MAX_PREVIEW_BLOCKS = 2000;
HoloPreviewEngine.MAX_PARTICLE_BLOCKS = 140;
HoloPreviewEngine.previews = new Map();
HoloPreviewEngine.previewDimensions = new Map();
HoloPreviewEngine.originalBlocks = new Map();
HoloPreviewEngine.states = new Map();
HoloPreviewEngine.overlayLocks = new Map();
HoloPreviewEngine.frozenPreviews = new Map();
HoloPreviewEngine.LIQUID_BLOCKS = new Set([
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:lava",
    "minecraft:flowing_lava"
]);
export function clearAllPreviewsFor(player) {
    HoloPreviewEngine.clearAllPreviews(player);
}
