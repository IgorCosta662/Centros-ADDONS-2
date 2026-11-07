import { world, system, BlockPermutation, GameMode, Player } from "@minecraft/server";
import { BlockSelectionManager } from "./models/blockSelection";
import { PlayerPatternSettings } from "./models/playerPatternSettings";
import { InventoryUtils } from "./inventoryUtils";
import { BlockUtils } from "./blockUtils";
import { MessageUtils } from "./messageUtils";
import { StaffConfig } from "../config/staffConfig";
import { HoloPreviewEngine } from "../engine/holoEngine";
import { RegionEngine } from "../engine/regionEngine";
import { BlueprintEngine } from "../engine/blueprintEngine";

export class PlayerUtils {
    static UPDATE_INTERVAL = 5;
    static hotbarUpdateId: number | undefined;
    static COLORS = {
        green: "§a",
        red: "§c",
        aqua: "§b",
        white: "§f",
        gray: "§8",
        darkGray: "§8",
        lightPurple: "§d",
        yellow: "§e"
    };

    static PATTERN_COLORS: Record<string, string> = {
        line: "§6",
        connected: "§b",
        floor: "§2",
        stairs: "§e",
        wall: "§a",
        arch: "§9",
        circle: "§d",
        cylinder: "§5",
        sphere: "§3",
        dome: "§b",
        cube: "§e",
        pyramid: "§6",
        spiral: "§b",
        gable_roof: "§6",
        torus: "§d",
        box2p: "§3",
        overlay: "§2",
        area: "§c",
        tunnel: "§4",
        foliage: "§a",
        blueprint: "§d"
    };

    static initialize(): void {
        if (this.hotbarUpdateId !== undefined) return;
        this.hotbarUpdateId = system.runInterval(() => {
            for (const player of world.getAllPlayers()) {
                this.updatePlayerHotbarMessage(player);
            }
        }, this.UPDATE_INTERVAL);
    }

    static cleanup(): void {
        if (this.hotbarUpdateId !== undefined) {
            system.clearRun(this.hotbarUpdateId);
            this.hotbarUpdateId = undefined;
        }
    }

    static syncAdjacentHotbarSelection(player: Player): void {
        if (!PlayerPatternSettings.isAutoAdjacentSlot(player.name)) return;
        const mode = PlayerPatternSettings.getMode(player.name);
        if (mode !== "construction" || PlayerPatternSettings.isRandomizerActive(player.name)) return;

        const inv = InventoryUtils.getPlayerInventory(player);
        if (!inv?.container) return;
        const nextSlot = (player.selectedSlotIndex + 1) % 9;
        const adjItem = inv.container.getItem(nextSlot);
        if (!adjItem) return;

        const typeId = adjItem.typeId;
        if (StaffConfig.isStaff(typeId) || typeId === "arc_st:architect_tome" || HoloPreviewEngine.isPreviewBlock(typeId)) return;

        const shortId = typeId.replace("minecraft:", "");
        if (shortId.includes("shulker_box") || shortId === "chest" || shortId === "trapped_chest" ||
            shortId === "barrel" || shortId === "ender_chest" || shortId.endsWith("_bed") ||
            shortId.endsWith("_door") || shortId.includes("sign") || shortId.includes("banner")) {
            return;
        }

        const current = BlockSelectionManager.getSelection(player.name);
        if (current?.blockType === typeId) return;

        try {
            const permutation = BlockPermutation.resolve(typeId);
            BlockSelectionManager.setSelection(player.name, { blockType: typeId, permutation });
        } catch { }
    }

    static updatePlayerHotbarMessage(player: Player): void {
        let heldItem = InventoryUtils.getHeldItem(player);
        if (!heldItem || !StaffConfig.isStaff(heldItem.typeId)) {
            player.onScreenDisplay.setActionBar("");
            return;
        }
        const mode = PlayerPatternSettings.getMode(player.name);
        heldItem = InventoryUtils.syncHeldStaffAppearance(player, mode) ?? heldItem;
        this.syncAdjacentHotbarSelection(player);

        const selection = BlockSelectionManager.getSelection(player.name);
        const maxBlocks = StaffConfig.maxBlocks[heldItem.typeId];
        const modeDisplay = this.getModeDisplay(mode);
        const patternDisplay = this.getPatternDisplay(player.name, player.dimension.id, mode);
        const selectionDisplay = this.getSelectionDisplay(player, heldItem.typeId, selection, mode);
        const maxDisplay = `${this.COLORS.lightPurple}Máx: ${this.COLORS.white}${maxBlocks}`;
        const previewCount = HoloPreviewEngine.getPreviewCount(player);
        const isFrozen = HoloPreviewEngine.isPreviewFrozen(player.name);
        const frozenTag = isFrozen ? ` §b[TRAVADO]` : "";
        const supplyStatus = InventoryUtils.getSupplyChestStatus(player);
        const chestTag = supplyStatus.validBlock ? ` §6[BAÚ]` : "";
        const torchTag = PlayerPatternSettings.isAutoTorch(player.name) ? ` §e[LUZ]` : "";
        const previewSuffix = previewCount > 0
            ? ` ${this.COLORS.gray}->${this.COLORS.white}${previewCount}${frozenTag}`
            : frozenTag;

        let message = `${modeDisplay}${chestTag}${torchTag} ${this.COLORS.darkGray}| ${patternDisplay}${previewSuffix}`;
        if (mode === "replace" || mode === "blueprint") {
            message += ` ${this.COLORS.darkGray}| ${selectionDisplay}`;
        } else {
            message += ` ${this.COLORS.darkGray}| ${selectionDisplay} ${this.COLORS.darkGray}| ${maxDisplay}`;
        }

        if (player.getGameMode() !== GameMode.creative) {
            if (StaffConfig.isUnbreakable(heldItem.typeId)) {
                message += ` ${this.COLORS.darkGray}| §7Uso: §b∞`;
            } else {
                const dur = InventoryUtils.getStaffDurabilityInfo(heldItem);
                if (dur) {
                    const ratio = dur.remaining / dur.max;
                    const durColor = (dur.remaining <= 10 || ratio <= 0.1)
                        ? this.COLORS.red
                        : ratio <= 0.3
                            ? this.COLORS.yellow
                            : this.COLORS.green;
                    message += ` ${this.COLORS.darkGray}| §7Uso: ${durColor}${dur.remaining}`;
                }
            }
        }

        player.onScreenDisplay.setActionBar(message);
    }

    static getModeDisplay(mode: string): string {
        const modeColors: Record<string, string> = {
            construction: this.COLORS.green,
            destruction: this.COLORS.red,
            replace: this.COLORS.yellow,
            blueprint: this.COLORS.lightPurple
        };
        const color = modeColors[mode] || this.COLORS.white;
        return `${color}${MessageUtils.getModeLabel(mode)}`;
    }

    static getPatternDisplay(playerName: string, dimensionId: string, mode: string): string {
        if (mode === "blueprint") {
            const copyP1 = BlueprintEngine.getCopyPos1(playerName, dimensionId);
            if (copyP1) return `§dCopiar: §e[Ponto B?]`;
            if (BlueprintEngine.isCapturing(playerName)) return `§dCopiar: §f[Ponto A?]`;
            const cb = BlueprintEngine.getOrCreateClipboard(playerName);
            const mirrorSuffix = cb.mirrorX ? " §b[ESP]" : "";
            return `§dColar: §f${cb.rotation}°${mirrorSuffix}`;
        }

        let pattern = "";
        if (mode === "construction") pattern = PlayerPatternSettings.getConstructionPattern(playerName);
        else if (mode === "destruction") pattern = PlayerPatternSettings.getDestructionPattern(playerName);
        else if (mode === "replace") pattern = PlayerPatternSettings.getReplaceMode(playerName);

        let lockSuffix = "";
        if (pattern === "connected") {
            const lock = PlayerPatternSettings.getConnectedSettings(playerName).directionLock;
            if (lock === "horizontal") lockSuffix = " §7[H]";
            else if (lock === "vertical") lockSuffix = " §7[V]";
        } else if (mode === "construction" && pattern === "line") {
            const snap = PlayerPatternSettings.getLineSettings(playerName).snap;
            if (snap === "cardinal") lockSuffix = " §7[90°]";
            else if (snap === "diagonal") lockSuffix = " §7[45°]";
        } else if (pattern === "box2p") {
            const hasP1 = RegionEngine.hasPos1(playerName, dimensionId, mode);
            lockSuffix = hasP1 ? " §e[Pos2?]" : " §7[Pos1]";
        }

        const color = this.PATTERN_COLORS[pattern] || this.COLORS.white;
        return `${this.COLORS.aqua}Padrão: ${color}${MessageUtils.getPatternLabel(pattern)}${lockSuffix}`;
    }

    static getSelectionDisplay(
        player: Player,
        staffId: string,
        selection: ReturnType<typeof BlockSelectionManager.getSelection>,
        mode: string
    ): string {
        if (mode === "blueprint") {
            if (BlueprintEngine.hasActiveBlueprint(player.name)) {
                const cb = BlueprintEngine.getOrCreateClipboard(player.name);
                return `§d${cb.name} §7(${cb.blocks.length} bl)`;
            }
            return `§eMarque 2 cantos para copiar`;
        }
        if (mode === "destruction" && PlayerPatternSettings.getDestructionPattern(player.name) === "foliage") {
            const fs = PlayerPatternSettings.getFoliageDestroySettings(player.name);
            return `§aRaio ${fs.radius}${fs.includeLeaves ? " §2[+Folhas]" : ""}`;
        }
        if (mode === "replace") {
            const replaceSettings = PlayerPatternSettings.getReplaceSettings(player.name);
            const findText = replaceSettings.findBlock
                ? BlockUtils.getReadableBlockName(replaceSettings.findBlock)
                : (replaceSettings.weatheringMode ? "Auto Ruína" : "Nenhum");
            const replaceText = replaceSettings.weatheringMode
                ? "§2Envelhecer"
                : replaceSettings.usePalette
                    ? "§dPaleta (%)"
                    : (replaceSettings.replaceBlock ? BlockUtils.getReadableBlockName(replaceSettings.replaceBlock) : "Nenhum");
            return `${this.COLORS.yellow}Alvo: ${this.COLORS.white}${findText} ${this.COLORS.gray}->${this.COLORS.green}${replaceText}`;
        }
        if (mode === "construction" && PlayerPatternSettings.isRandomizerActive(player.name)) {
            const maxPal = StaffConfig.getMaxPaletteSize(staffId);
            const palette = PlayerPatternSettings.getPalette(player.name, maxPal);
            if (palette.length > 0) {
                if (palette.length <= 3) {
                    const names = palette.map(bt => BlockUtils.getReadableBlockName(bt)).join(`${this.COLORS.gray},${this.COLORS.white}`);
                    return `${this.COLORS.green}Paleta: ${this.COLORS.white}${names}`;
                }
                return `${this.COLORS.green}Paleta: ${this.COLORS.white}${palette.length}/${maxPal}`;
            }
            return `${this.COLORS.green}Paleta: ${this.COLORS.red}Vazia`;
        }
        if (!selection) {
            return `${this.COLORS.aqua}Bloco: ${this.COLORS.red}Nenhum`;
        }
        const blockName = BlockUtils.getReadableBlockName(selection.blockType);
        const similarTag = (mode === "destruction" && PlayerPatternSettings.isMatchSimilarBlocks(player.name)) ? " §e[+]" : "";
        const isCreative = player.getGameMode() === GameMode.creative;
        if (!isCreative && mode === "construction") {
            const available = InventoryUtils.countItemsInInventory(player, selection.blockType);
            return `${this.COLORS.aqua}Bloco: ${this.COLORS.white}${blockName} ${this.COLORS.gray}(${available})`;
        }
        return `${this.COLORS.aqua}Bloco: ${this.COLORS.white}${blockName}${similarTag}`;
    }

    static sendMessage(player: Player, message: string): void {
        player.sendMessage(message);
    }

    static playSuccessSound(player: Player): void {
        player.playSound("random.levelup", { volume: 1, pitch: 1 });
    }

    static isHoldingStaff(player: Player): boolean {
        const heldItem = InventoryUtils.getHeldItem(player);
        return heldItem ? StaffConfig.isStaff(heldItem.typeId) : false;
    }
}
