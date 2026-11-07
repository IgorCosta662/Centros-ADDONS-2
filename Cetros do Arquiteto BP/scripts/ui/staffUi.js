import { GameMode } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { PlayerPatternSettings } from "../api/models/playerPatternSettings";
import { StaffConfig } from "../config/staffConfig";
import { InventoryUtils } from "../api/inventoryUtils";
import { PlayerUtils } from "../api/playerUtils";
import { BlockUtils } from "../api/blockUtils";
import { BlockSelectionManager } from "../api/models/blockSelection";
import { MessageUtils } from "../api/messageUtils";
import { GuideEngine } from "../engine/guideEngine";
import { UndoEngine } from "../engine/undoEngine";
import { HoloPreviewEngine } from "../engine/holoEngine";
import { StaffEngine } from "../engine/staffEngine";
import { StaffSpecialEngine } from "../engine/staffSpecialEngine";
import { RegionEngine } from "../engine/regionEngine";
import { BlueprintEngine } from "../engine/blueprintEngine";
const UI_BASE = "textures/igorcosta/architect_staffs/ui";
const ITEM_BASE = "textures/igorcosta/architect_staffs/items";
const ICON_BUILD = `${UI_BASE}/mode_build`;
const ICON_BREAK = `${UI_BASE}/mode_break`;
const ICON_SWAP = `${UI_BASE}/mode_swap`;
const ICON_BLUEPRINT = `${UI_BASE}/act_blueprint`;
const ICON_CHEST = `${UI_BASE}/act_chest`;
const ICON_TORCH = `${UI_BASE}/act_torch`;
const ICON_ROTATE = `${UI_BASE}/act_rotate`;
const ICON_UNDO = `${UI_BASE}/act_undo`;
const ICON_REDO = `${UI_BASE}/act_redo`;
const ICON_FREEZE = `${UI_BASE}/act_freeze`;
const ICON_CLEAR = `${UI_BASE}/act_clear`;
const ICON_RANDOMIZER = `${UI_BASE}/act_random`;
const ICON_PALETTE = `${UI_BASE}/act_palette`;
const ICON_SETTINGS = `${UI_BASE}/act_settings`;
const ICON_BACK = `${UI_BASE}/act_back`;
const ICON_AREA_EDIT = `${UI_BASE}/act_area_edit`;
const ICON_AUTO_SLOT = `${UI_BASE}/act_auto_slot`;
const ICON_GUIDE = `${UI_BASE}/act_guide`;
const ICON_TIER = `${UI_BASE}/act_tier`;
const ICON_PREFAB = `${UI_BASE}/act_prefab`;
const ICON_PAINT = `${UI_BASE}/act_paint`;
const ICON_CALC = `${UI_BASE}/act_calc`;
const ICON_TROPHY = `${UI_BASE}/act_trophy`;
const PATTERN_ICONS = {
    connected: `${UI_BASE}/pat_connected`,
    line: `${UI_BASE}/pat_line`,
    floor: `${UI_BASE}/pat_floor`,
    stairs: `${UI_BASE}/pat_stairs`,
    overlay: `${UI_BASE}/pat_overlay`,
    smooth: `${UI_BASE}/pat_smooth`,
    wall: `${UI_BASE}/pat_wall`,
    spiral: `${UI_BASE}/pat_spiral`,
    box2p: `${UI_BASE}/pat_box2p`,
    arch: `${UI_BASE}/pat_arch`,
    gable_roof: `${UI_BASE}/pat_gable`,
    circle: `${UI_BASE}/pat_circle`,
    cylinder: `${UI_BASE}/pat_cylinder`,
    sphere: `${UI_BASE}/pat_sphere`,
    dome: `${UI_BASE}/pat_dome`,
    torus: `${UI_BASE}/pat_torus`,
    cube: `${UI_BASE}/pat_cube`,
    pyramid: `${UI_BASE}/pat_pyramid`,
    tunnel: `${UI_BASE}/pat_tunnel`,
    foliage: `${UI_BASE}/pat_foliage`,
    area: `${UI_BASE}/act_area_edit`,
    blueprint: `${UI_BASE}/act_blueprint`
};
const PATTERN_MIN_TIER_LABEL = {
    wall: "Cobre+",
    spiral: "Cobre+",
    box2p: "Ferro+",
    arch: "Ferro+",
    gable_roof: "Ferro+",
    circle: "Ferro+",
    cylinder: "Ferro+",
    sphere: "Ametista/Diamante+",
    dome: "Ametista/Diamante+",
    torus: "Ametista/Oceânico/Diamante+",
    cube: "Redstone/Diamante+",
    pyramid: "Oceânico/Diamante+"
};
export class StaffUI {
    static sendPatternConfirmation(player, pattern) {
        MessageUtils.sendSuccessMessage(player, `Formato definido para: ${MessageUtils.getPatternLabel(pattern).toUpperCase()}`);
        player.playSound("random.orb", { pitch: 1.2, volume: 0.5 });
    }
    static checkLagWarning(player, value, threshold, type) {
        if (value > threshold) {
            player.sendMessage(`§6 Aviso: ${type} muito grande pode causar lag!`);
            player.playSound("note.pling", { pitch: 0.8, volume: 0.5 });
        }
    }
    static async openMainMenu(player) {
        const mode = PlayerPatternSettings.getMode(player.name);
        const previewStyle = PlayerPatternSettings.getPreviewStyle(player.name);
        const isFrozen = HoloPreviewEngine.isPreviewFrozen(player.name);
        const autoAdj = PlayerPatternSettings.isAutoAdjacentSlot(player.name);
        const heldItem = InventoryUtils.getHeldItem(player);
        const specialAbility = heldItem ? StaffConfig.getSpecialAbility(heldItem.typeId) : null;
        const undoCount = UndoEngine.getCount(player.name);
        const redoCount = UndoEngine.getRedoCount(player.name);
        const undoLabel = undoCount > 0 ? `§aDesfazer §f(${undoCount}/5)` : `§8Desfazer (0/5)`;
        const redoLabel = redoCount > 0 ? `§bRefazer §f(${redoCount}/5)` : `§8Refazer (0/5)`;
        const previewLabel = previewStyle === "particles"
            ? "§bHolograma: §aGrade Laser"
            : "§bHolograma: §eBlocos Sólidos";
        const freezeLabel = isFrozen
            ? "§bDestravar Holograma §f[TRAVADO]"
            : "§3Travar Holograma no Local";
        const autoAdjLabel = autoAdj
            ? "§aBloco do Slot Vizinho: §fLIGADO"
            : "§8Bloco do Slot Vizinho: DESLIGADO";
        const activePattern = mode === "construction"
            ? PlayerPatternSettings.getConstructionPattern(player.name)
            : mode === "destruction"
                ? PlayerPatternSettings.getDestructionPattern(player.name)
                : mode === "replace"
                    ? PlayerPatternSettings.getReplaceMode(player.name)
                    : "blueprint";
        const supplyStatus = InventoryUtils.getSupplyChestStatus(player);
        const chestLabel = supplyStatus.validBlock
            ? `§6Baú de Suprimentos: §aATIVO (${supplyStatus.distance}m)`
            : supplyStatus.linked
                ? `§6Baú de Suprimentos: §eFORA DE ALCANCE`
                : `§8Baú de Suprimentos: DESVINCULADO`;
        const autoTorch = PlayerPatternSettings.isAutoTorch(player.name);
        const autoOrient = PlayerPatternSettings.isAutoOrientBlocks(player.name);
        const autoCraft = PlayerPatternSettings.isAutoCraftBlocks(player.name);
        const autoSummary = `§eAutomação & Bancada §8[${autoTorch ? "§aLuz" : "§7Sem Luz"}§8 | ${autoOrient ? "§aAlinhar" : "§7Padrão"}§8 | ${autoCraft ? "§aCraft" : "§7Sem Craft"}§8]`;
        const mastery = PlayerPatternSettings.getMasteryRank(player.name);
        const entries = [];
        if (heldItem && specialAbility) {
            const baseName = StaffConfig.getBaseStaffId(heldItem.typeId).replace("arc_st:", "");
            const staffIcon = `${ITEM_BASE}/${baseName}`;
            entries.push({
                label: StaffSpecialEngine.getSpecialButtonLabel(specialAbility),
                icon: staffIcon,
                action: async () => {
                    await StaffSpecialEngine.executeSpecialAbility(player, heldItem, specialAbility);
                }
            });
        }
        entries.push({
            label: mode === "construction" ? "§a> Modo Construção <" : "§8Modo Construção",
            icon: ICON_BUILD,
            action: async () => {
                RegionEngine.clearPos1(player.name);
                PlayerPatternSettings.setMode(player.name, "construction");
                InventoryUtils.syncHeldStaffAppearance(player, "construction");
                PlayerUtils.updatePlayerHotbarMessage(player);
                await this.openConstructionMenu(player);
            }
        }, {
            label: mode === "destruction" ? "§c> Modo Demolição <" : "§8Modo Demolição",
            icon: ICON_BREAK,
            action: async () => {
                RegionEngine.clearPos1(player.name);
                PlayerPatternSettings.setMode(player.name, "destruction");
                InventoryUtils.syncHeldStaffAppearance(player, "destruction");
                PlayerUtils.updatePlayerHotbarMessage(player);
                await this.openDestructionMenu(player);
            }
        }, {
            label: mode === "replace" ? "§e> Modo Substituição <" : "§8Modo Substituição",
            icon: ICON_SWAP,
            action: async () => {
                RegionEngine.clearPos1(player.name);
                PlayerPatternSettings.setMode(player.name, "replace");
                InventoryUtils.syncHeldStaffAppearance(player, "replace");
                PlayerUtils.updatePlayerHotbarMessage(player);
                await this.openReplaceMenu(player);
            }
        }, {
            label: mode === "blueprint" ? "§d> Plantas & Prefabs <" : "§8Plantas & Prefabs",
            icon: ICON_BLUEPRINT,
            action: async () => {
                RegionEngine.clearPos1(player.name);
                PlayerPatternSettings.setMode(player.name, "blueprint");
                InventoryUtils.syncHeldStaffAppearance(player, "blueprint");
                PlayerUtils.updatePlayerHotbarMessage(player);
                await this.openBlueprintMenu(player);
            }
        }, {
            label: "§bAjustes do Formato Atual",
            icon: ICON_SETTINGS,
            action: async () => {
                await this.openModeSettings(player, mode);
            }
        }, {
            label: "§3Calculadora de Obra & Materiais",
            icon: ICON_CALC,
            action: async () => {
                await this.openMaterialCalculator(player);
            }
        }, {
            label: chestLabel,
            icon: ICON_CHEST,
            action: async () => {
                await this.openSupplyChestMenu(player);
            }
        }, {
            label: autoSummary,
            icon: ICON_TORCH,
            action: async () => {
                await this.openAutomationSettings(player);
            }
        }, {
            label: freezeLabel,
            icon: ICON_FREEZE,
            action: () => {
                const wasFrozen = HoloPreviewEngine.isPreviewFrozen(player.name);
                const result = HoloPreviewEngine.toggleFreezePreview(player);
                PlayerUtils.updatePlayerHotbarMessage(player);
                if (result.frozen) {
                    MessageUtils.sendSuccessMessage(player, `Holograma travado (${result.count} blocos)! Caminhe para inspecionar e use o cetro para confirmar.`);
                    player.playSound("random.orb", { pitch: 1.3, volume: 0.8 });
                }
                else if (wasFrozen) {
                    MessageUtils.sendSuccessMessage(player, "Holograma destravado.");
                    player.playSound("random.click", { pitch: 1.0, volume: 0.7 });
                }
                else {
                    MessageUtils.sendErrorMessage(player, "Aponte para um local com holograma ativo antes de travar!");
                    player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                }
            }
        }, {
            label: undoLabel,
            icon: ICON_UNDO,
            action: async () => {
                UndoEngine.undo(player);
                await this.openMainMenu(player);
            }
        }, {
            label: redoLabel,
            icon: ICON_REDO,
            action: async () => {
                UndoEngine.redo(player);
                await this.openMainMenu(player);
            }
        }, {
            label: previewLabel,
            icon: ICON_TIER,
            action: async () => {
                const nextStyle = previewStyle === "particles" ? "blocks" : "particles";
                HoloPreviewEngine.clearAllPreviews(player);
                PlayerPatternSettings.setPreviewStyle(player.name, nextStyle);
                MessageUtils.sendSuccessMessage(player, `Estilo do holograma alterado para: ${nextStyle === "particles" ? "Grade Laser" : "Blocos Sólidos"}`);
                await this.openMainMenu(player);
            }
        }, {
            label: autoAdjLabel,
            icon: ICON_AUTO_SLOT,
            action: async () => {
                const nextVal = !autoAdj;
                PlayerPatternSettings.setAutoAdjacentSlot(player.name, nextVal);
                if (nextVal) {
                    PlayerUtils.syncAdjacentHotbarSelection(player);
                    MessageUtils.sendSuccessMessage(player, "Auto-Bloco ativado! O cetro usará automaticamente o bloco à direita na Hotbar.");
                }
                else {
                    MessageUtils.sendMessage(player, "§7Auto-Bloco do slot vizinho desativado.");
                }
                PlayerUtils.updatePlayerHotbarMessage(player);
                await this.openMainMenu(player);
            }
        }, {
            label: `§6Maestria: ${mastery.color}${mastery.title}`,
            icon: ICON_TROPHY,
            action: async () => {
                await this.openMasteryProfile(player);
            }
        }, {
            label: "§eTomo do Arquiteto (Guia v4.0)",
            icon: ICON_GUIDE,
            action: async () => {
                await GuideEngine.openTutorial(player);
            }
        });
        const form = new ActionFormData()
            .title("§l§bCETRO DO ARQUITETO")
            .body(`§8Patente: ${mastery.color}${mastery.title} §8(${mastery.totalScore} bl)\n` +
            `§8Modo: ${this.getModeBodyText(mode)} §8| Formato: §f${MessageUtils.getPatternLabel(activePattern)}` +
            `${isFrozen ? " §b[TRAVADO]" : ""}${supplyStatus.validBlock ? " §6[BAÚ]" : ""}\n` +
            `§8Atalho: §7Agachar + Bater §8captura bloco ou vincula Baú/Barril!`);
        for (const entry of entries) {
            form.button(entry.label, entry.icon);
        }
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined)
            return;
        const chosen = entries[response.selection];
        if (chosen) {
            await chosen.action();
        }
    }
    static getModeBodyText(mode) {
        switch (mode) {
            case "construction": return "§aConstrução";
            case "destruction": return "§cDemolição";
            case "replace": return "§eSubstituição";
            case "blueprint": return "§dPlanta (Copiar/Colar)";
            default: return `§f${mode}`;
        }
    }
    static async openModeSettings(player, mode) {
        switch (mode) {
            case "construction":
                await this.openConstructionMenu(player);
                break;
            case "destruction":
                await this.openDestructionMenu(player);
                break;
            case "replace":
                await this.openReplaceMenu(player);
                break;
            case "blueprint":
                await this.openBlueprintMenu(player);
                break;
            default:
                await this.openMainMenu(player);
                break;
        }
    }
    static async openSupplyChestMenu(player) {
        const status = InventoryUtils.getSupplyChestStatus(player);
        let statusBody = "§8Nenhum Baú ou Barril vinculado.\n\n" +
            "§7Vincule um Baú/Barril para puxar blocos automaticamente ao construir e guardar minérios/blocos escavados (alcance de até §e100 blocos§7)!\n\n" +
            "§bDica Rápida: §fAgachar + Bater §7direto num Baú ou Barril vincula na hora!";
        if (status.linked && status.coords) {
            const stateStr = status.validBlock
                ? `§aATIVO (${status.distance}m de distância)`
                : status.inRange
                    ? `§cBLOCO AUSENTE (baú foi quebrado)`
                    : `§eFORA DE ALCANCE (${status.distance}m > 100m ou outra dimensão)`;
            statusBody =
                `§6Coordenadas: §f(${status.coords.x}, ${status.coords.y}, ${status.coords.z})\n` +
                    `§6Status: ${stateStr}\n\n` +
                    `§7Enquanto ativo, o cetro consome blocos do inventário + baú e deposita blocos escavados direto no baú!`;
        }
        const form = new ActionFormData()
            .title("§l§6BAÚ DE SUPRIMENTOS")
            .body(statusBody)
            .button("§aVincular Baú/Barril na Mira", ICON_CHEST);
        if (status.linked) {
            form.button("§cDesvincular Baú Atual", ICON_CLEAR);
        }
        form.button("§8Voltar ao Painel Principal", ICON_BACK);
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined)
            return;
        if (response.selection === 0) {
            const ok = StaffEngine.linkAimedSupplyChest(player);
            if (!ok) {
                MessageUtils.sendErrorMessage(player, "Aponte para um Baú ou Barril próximo (até 12 blocos) ou use Agachar + Bater nele!");
                player.playSound("note.bass", { pitch: 0.8, volume: 0.8 });
            }
            await this.openSupplyChestMenu(player);
        }
        else if (status.linked && response.selection === 1) {
            PlayerPatternSettings.setSupplyChest(player.name, null);
            PlayerUtils.updatePlayerHotbarMessage(player);
            MessageUtils.sendMessage(player, "§eBaú de Suprimentos desvinculado.");
            await this.openSupplyChestMenu(player);
        }
        else {
            await this.openMainMenu(player);
        }
    }
    static async openAutomationSettings(player) {
        const autoOrient = PlayerPatternSettings.isAutoOrientBlocks(player.name);
        const autoTorch = PlayerPatternSettings.isAutoTorch(player.name);
        const spacing = PlayerPatternSettings.getTorchSpacing(player.name);
        const autoCraft = PlayerPatternSettings.isAutoCraftBlocks(player.name);
        const response = await new ModalFormData()
            .title("§l§eAUTOMAÇÃO & BANCADA")
            .toggle("Auto-Alinhar Escadas, Telhados, Espiral e Vigas/Troncos", autoOrient)
            .toggle("Bancada Automática (Craftar Tábuas/Tijolos/Escadas/Lajes na hora)", autoCraft)
            .toggle("Auto-Iluminar Obras e Túneis (Tochas/Lanternas)", autoTorch)
            .slider("Espaçamento entre Tochas (Blocos)", 3, 12, 1, spacing)
            .toggle("§8Voltar ao Painel Principal", true)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setAutoOrientBlocks(player.name, response.formValues[0]);
        PlayerPatternSettings.setAutoCraftBlocks(player.name, response.formValues[1]);
        PlayerPatternSettings.setAutoTorch(player.name, response.formValues[2]);
        PlayerPatternSettings.setTorchSpacing(player.name, response.formValues[3]);
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendSuccessMessage(player, "Configurações de automação e bancada atualizadas!");
        if (response.formValues[4] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openBlueprintMenu(player) {
        const cb = BlueprintEngine.getOrCreateClipboard(player.name);
        const hasActive = BlueprintEngine.hasActiveBlueprint(player.name);
        let body = "";
        if (hasActive) {
            const reqs = BlueprintEngine.getRequiredMaterials(player.name);
            const topMats = Array.from(reqs.entries())
                .slice(0, 5)
                .map(([bt, cnt]) => `§f${cnt}x §7${BlockUtils.getReadableBlockName(bt)}`)
                .join(", ");
            const more = reqs.size > 5 ? ` §8(+${reqs.size - 5} tipos)` : "";
            body =
                `§dPlanta Ativa: §f${cb.name} §7(${cb.blocks.length} blocos • ${cb.width}x${cb.height}x${cb.length})\n` +
                    `§bRotação: §f${cb.rotation}° §8| §bEspelhar X: ${cb.mirrorX ? "§aSIM" : "§8NÃO"}\n` +
                    `§6Materiais: ${topMats}${more}\n\n` +
                    `§7Feche o menu e aponte para o chão para visualizar o holograma e colar!`;
        }
        else {
            body =
                "§8Nenhuma estrutura ativa na área de transferência.\n\n" +
                    "§7Clique em §aCopiar Nova Estrutura§7 (Ponto A → B), carregue uma §6Estrutura Pronta (Prefab)§7 ou acesse suas §e3 Plantas Salvas§7!";
        }
        const entries = [
            {
                label: "§6Catálogo de Estruturas Prontas (6 Prefabs)",
                icon: ICON_PREFAB,
                action: async () => {
                    await this.openPrefabsMenu(player);
                }
            },
            {
                label: "§aCopiar Nova Estrutura (Ponto A → B)",
                icon: ICON_BLUEPRINT,
                action: () => {
                    BlueprintEngine.armCapture(player.name);
                    HoloPreviewEngine.unfreezePreview(player.name);
                    HoloPreviewEngine.clearAllPreviews(player);
                    PlayerUtils.updatePlayerHotbarMessage(player);
                    MessageUtils.sendSuccessMessage(player, "Modo Captura ativado! Clique no bloco do Ponto A e depois no Ponto B oposto.");
                    player.playSound("random.orb", { pitch: 1.2, volume: 0.8 });
                }
            }
        ];
        if (hasActive) {
            entries.push({
                label: `§bGirar Planta +90° §f(Atual: ${cb.rotation}°)`,
                icon: ICON_ROTATE,
                action: async () => {
                    const rot = BlueprintEngine.rotateClipboard(player.name);
                    HoloPreviewEngine.unfreezePreview(player.name);
                    HoloPreviewEngine.clearAllPreviews(player);
                    PlayerUtils.updatePlayerHotbarMessage(player);
                    MessageUtils.sendSuccessMessage(player, `Planta girada para ${rot}°!`);
                    player.playSound("random.click", { pitch: 1.2, volume: 0.8 });
                    await this.openBlueprintMenu(player);
                }
            }, {
                label: cb.mirrorX ? "§bEspelhar Planta: §aATIVO" : "§8Espelhar Planta: DESLIGADO",
                icon: ICON_ROTATE,
                action: async () => {
                    const mir = BlueprintEngine.toggleMirrorClipboard(player.name);
                    HoloPreviewEngine.unfreezePreview(player.name);
                    HoloPreviewEngine.clearAllPreviews(player);
                    PlayerUtils.updatePlayerHotbarMessage(player);
                    MessageUtils.sendMessage(player, mir ? "§bEspelhamento da planta ativado!" : "§7Espelhamento da planta desativado.");
                    await this.openBlueprintMenu(player);
                }
            });
        }
        else if (cb.blocks.length > 0 && cb.captureArmed) {
            entries.push({
                label: `§aVoltar a Colar '${cb.name}'`,
                icon: ICON_BUILD,
                action: async () => {
                    BlueprintEngine.cancelCapture(player.name);
                    PlayerUtils.updatePlayerHotbarMessage(player);
                    await this.openBlueprintMenu(player);
                }
            });
        }
        entries.push({
            label: "§eSlots de Plantas Salvas (3 Slots)",
            icon: ICON_PALETTE,
            action: async () => {
                await this.openBlueprintSlotsMenu(player);
            }
        }, {
            label: "§8Voltar ao Painel Principal",
            icon: ICON_BACK,
            action: async () => {
                await this.openMainMenu(player);
            }
        });
        const form = new ActionFormData()
            .title("§l§dPLANTAS & PREFABS")
            .body(body);
        for (const e of entries)
            form.button(e.label, e.icon);
        const res = await form.show(player);
        if (res.canceled || res.selection === undefined)
            return;
        const chosen = entries[res.selection];
        if (chosen)
            await chosen.action();
    }
    static async openPrefabsMenu(player) {
        const selectedBlock = BlockSelectionManager.getSelection(player.name)?.blockType || "minecraft:stone_bricks";
        const readableMat = BlockUtils.getReadableBlockName(selectedBlock);
        const body = `§6Bloco Base da Estrutura: §f${readableMat}\n` +
            `§7(Capture outro bloco no mundo caso queira personalizar o material base das paredes/arcos!)\n\n` +
            `§8Escolha um Prefab abaixo para carregá-lo no holograma 3D com suporte a Rotação 90° e Sobrevivência:`;
        const entries = BlueprintEngine.PREFABS.map((prefab) => ({
            label: `§e${prefab.name}\n§8${prefab.dims} • ${prefab.description}`,
            icon: ICON_PREFAB,
            action: async () => {
                const res = BlueprintEngine.loadPrefabToClipboard(player, prefab.id, selectedBlock);
                HoloPreviewEngine.unfreezePreview(player.name);
                HoloPreviewEngine.clearAllPreviews(player);
                PlayerUtils.updatePlayerHotbarMessage(player);
                if (res.ok) {
                    MessageUtils.sendSuccessMessage(player, res.message);
                    player.playSound("random.levelup", { pitch: 1.25, volume: 0.8 });
                }
                else {
                    MessageUtils.sendErrorMessage(player, res.message);
                }
                await this.openBlueprintMenu(player);
            }
        }));
        entries.push({
            label: "§8Voltar ao Menu de Plantas",
            icon: ICON_BACK,
            action: async () => {
                await this.openBlueprintMenu(player);
            }
        });
        const form = new ActionFormData()
            .title("§l§6CATÁLOGO DE PREFABS (6 OBRAS)")
            .body(body);
        for (const e of entries)
            form.button(e.label, e.icon);
        const res = await form.show(player);
        if (res.canceled || res.selection === undefined)
            return;
        const chosen = entries[res.selection];
        if (chosen)
            await chosen.action();
    }
    static async openBlueprintSlotsMenu(player) {
        const slots = BlueprintEngine.getSavedSlotsInfo(player);
        const hasClipboard = BlueprintEngine.getOrCreateClipboard(player.name).blocks.length > 0;
        const body = slots.map((s, i) => s ? `§eSlot ${i + 1}: §f${s.name} §7(${s.blockCount} bl • ${s.dims})` : `§8Slot ${i + 1}: Vazio`).join("\n");
        const entries = [];
        for (let i = 0; i < 3; i++) {
            const info = slots[i];
            if (info) {
                entries.push({
                    label: `§aCarregar Slot ${i + 1}: §f${info.name}`,
                    icon: ICON_BLUEPRINT,
                    action: async () => {
                        const r = BlueprintEngine.loadSlotToClipboard(player, i);
                        HoloPreviewEngine.unfreezePreview(player.name);
                        HoloPreviewEngine.clearAllPreviews(player);
                        PlayerUtils.updatePlayerHotbarMessage(player);
                        if (r.ok) {
                            MessageUtils.sendSuccessMessage(player, r.message);
                            player.playSound("random.levelup", { pitch: 1.2, volume: 0.7 });
                        }
                        else {
                            MessageUtils.sendErrorMessage(player, r.message);
                        }
                        await this.openBlueprintMenu(player);
                    }
                });
            }
            if (hasClipboard) {
                entries.push({
                    label: `§eSalvar Planta Atual no Slot ${i + 1}`,
                    icon: ICON_SETTINGS,
                    action: async () => {
                        const cb = BlueprintEngine.getOrCreateClipboard(player.name);
                        const modal = await new ModalFormData()
                            .title(`§l§eSALVAR NO SLOT ${i + 1}`)
                            .textField("Nome da Planta", "Ex: Torre Medieval", cb.name)
                            .show(player);
                        if (modal.canceled || !modal.formValues) {
                            await this.openBlueprintSlotsMenu(player);
                            return;
                        }
                        const name = String(modal.formValues[0] ?? "").slice(0, 28);
                        const r = BlueprintEngine.saveClipboardToSlot(player, i, name);
                        if (r.ok) {
                            MessageUtils.sendSuccessMessage(player, r.message);
                            player.playSound("random.orb", { pitch: 1.3, volume: 0.8 });
                        }
                        else {
                            MessageUtils.sendErrorMessage(player, r.message);
                            player.playSound("note.bass", { pitch: 0.8, volume: 0.8 });
                        }
                        await this.openBlueprintSlotsMenu(player);
                    }
                });
            }
            if (info) {
                entries.push({
                    label: `§cApagar Slot ${i + 1} (${info.name})`,
                    icon: ICON_CLEAR,
                    action: async () => {
                        BlueprintEngine.deleteSlot(player, i);
                        MessageUtils.sendMessage(player, `§eSlot ${i + 1} de planta apagado.`);
                        await this.openBlueprintSlotsMenu(player);
                    }
                });
            }
        }
        entries.push({
            label: "§8Voltar ao Menu de Plantas",
            icon: ICON_BACK,
            action: async () => {
                await this.openBlueprintMenu(player);
            }
        });
        const form = new ActionFormData()
            .title("§l§ePLANTAS SALVAS (3 SLOTS)")
            .body(body);
        for (const e of entries)
            form.button(e.label, e.icon);
        const res = await form.show(player);
        if (res.canceled || res.selection === undefined)
            return;
        const chosen = entries[res.selection];
        if (chosen)
            await chosen.action();
    }
    static async openConstructionMenu(player) {
        const current = PlayerPatternSettings.getConstructionPattern(player.name);
        const heldItem = InventoryUtils.getHeldItem(player);
        const staffId = heldItem?.typeId || "";
        const maxPal = StaffConfig.getMaxPaletteSize(staffId);
        const isRandomizer = PlayerPatternSettings.isRandomizerActive(player.name);
        const isPending = isRandomizer && PlayerPatternSettings.isRandomizerPending(player.name);
        const palette = PlayerPatternSettings.getPalette(player.name, maxPal);
        const randomizerLabel = isRandomizer ? "§aMistura Aleatória: LIGADA" : "§8Mistura Aleatória: DESLIGADA";
        const paletteLabel = `§ePaleta de Blocos §8(${palette.length}/${maxPal})`;
        const form = new ActionFormData()
            .title("§l§2PAINEL DE CONSTRUÇÃO")
            .body(`§8Formato: §f${MessageUtils.getPatternLabel(current)}§r §8| Mistura: ${isRandomizer ? "§aSIM" : "§8NÃO"}`)
            .button("§cLimpar Seleção", ICON_CLEAR);
        const patterns = [
            "connected", "line", "floor", "stairs", "overlay",
            "wall", "spiral", "box2p", "arch", "gable_roof",
            "circle", "cylinder", "sphere", "dome", "torus",
            "cube", "pyramid"
        ];
        patterns.forEach((pattern) => {
            const canUse = StaffConfig.canUsePattern(staffId, pattern);
            const isCurrent = current === pattern;
            const label = MessageUtils.getPatternLabel(pattern);
            const icon = PATTERN_ICONS[pattern] ?? ICON_BUILD;
            if (canUse) {
                form.button(isCurrent ? `§a> ${label} <` : `§8${label}`, icon);
            }
            else {
                const reqTier = PATTERN_MIN_TIER_LABEL[pattern] ?? "Superior";
                form.button(`§c${label} §8(${reqTier})`, icon);
            }
        });
        form.button(randomizerLabel, ICON_RANDOMIZER)
            .button(paletteLabel, ICON_PALETTE)
            .button("§8Voltar ao Painel Principal", ICON_BACK);
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined)
            return;
        const patternEndIdx = patterns.length;
        const randomizerIdx = patternEndIdx + 1;
        const paletteIdx = patternEndIdx + 2;
        const backIdx = patternEndIdx + 3;
        if (response.selection === 0) {
            RegionEngine.clearPos1(player.name);
            BlockSelectionManager.clearSelection(player.name);
            HoloPreviewEngine.unfreezePreview(player.name);
            HoloPreviewEngine.clearAllPreviews(player);
            PlayerUtils.updatePlayerHotbarMessage(player);
            await this.openConstructionMenu(player);
        }
        else if (response.selection >= 1 && response.selection <= patternEndIdx) {
            const selectedPattern = patterns[response.selection - 1];
            if (!StaffConfig.canUsePattern(staffId, selectedPattern)) {
                const reqTier = PATTERN_MIN_TIER_LABEL[selectedPattern] ?? "superior";
                MessageUtils.sendErrorMessage(player, `Este formato requer um Cetro de nível ${reqTier}!`);
                player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
                await this.openConstructionMenu(player);
                return;
            }
            RegionEngine.clearPos1(player.name);
            PlayerPatternSettings.setConstructionPattern(player.name, selectedPattern);
            HoloPreviewEngine.unfreezePreview(player.name);
            if (isPending) {
                if (palette.length === 0) {
                    MessageUtils.sendErrorMessage(player, "Mistura Aleatória: adicione blocos na paleta primeiro (no mundo ou importando da Hotbar).");
                    await this.openPaletteMenu(player);
                    return;
                }
                PlayerPatternSettings.setRandomizerPending(player.name, false);
            }
            PlayerUtils.updatePlayerHotbarMessage(player);
            await this.openConstructionSettings(player, selectedPattern);
        }
        else if (response.selection === randomizerIdx) {
            if (!isRandomizer) {
                PlayerPatternSettings.setRandomizerActive(player.name, true);
                if (palette.length === 0) {
                    PlayerPatternSettings.setRandomizerPending(player.name, true);
                    MessageUtils.sendSuccessMessage(player, `Mistura Aleatória LIGADA! Clique em até ${maxPal} blocos no mundo ou importe da Hotbar.`);
                }
                else {
                    PlayerPatternSettings.setRandomizerPending(player.name, false);
                    MessageUtils.sendSuccessMessage(player, `Mistura Aleatória LIGADA com ${palette.length} bloco(s) na paleta.`);
                }
            }
            else {
                PlayerPatternSettings.setRandomizerActive(player.name, false);
                PlayerPatternSettings.setRandomizerPending(player.name, false);
            }
            HoloPreviewEngine.unfreezePreview(player.name);
            HoloPreviewEngine.clearAllPreviews(player);
            PlayerUtils.updatePlayerHotbarMessage(player);
            await this.openConstructionMenu(player);
        }
        else if (response.selection === paletteIdx) {
            await this.openPaletteMenu(player);
        }
        else if (response.selection === backIdx) {
            await this.openMainMenu(player);
        }
    }
    static async openPaletteMenu(player) {
        const heldItem = InventoryUtils.getHeldItem(player);
        const maxPal = heldItem ? StaffConfig.getMaxPaletteSize(heldItem.typeId) : 6;
        const palette = [...PlayerPatternSettings.getPalette(player.name, maxPal)];
        const percentages = PlayerPatternSettings.getPalettePercentages(player.name, maxPal);
        const bodyLines = palette.length > 0
            ? "§8Blocos atuais e proporção de mistura (clique num bloco para removê-lo):\n" +
                palette.map((bt, idx) => {
                    const w = PlayerPatternSettings.getBlockWeight(player.name, bt);
                    const pct = percentages[bt] ?? 0;
                    return `§a${idx + 1}. §f${BlockUtils.getReadableBlockName(bt)} §8— §ePeso ${w} §7(${pct}%)`;
                }).join("\n")
            : "§8Sua paleta está vazia.\n§7Adicione clicando em blocos no mundo (com Mistura ligada), importe da Hotbar ou carregue uma Paleta Favorita!";
        const entries = [
            {
                label: "§aImportar Blocos da Hotbar",
                icon: ICON_AUTO_SLOT,
                action: async () => {
                    const added = StaffEngine.importHotbarToPalette(player);
                    if (added > 0) {
                        PlayerPatternSettings.setRandomizerActive(player.name, true);
                        PlayerPatternSettings.setRandomizerPending(player.name, false);
                        PlayerUtils.updatePlayerHotbarMessage(player);
                        MessageUtils.sendSuccessMessage(player, `${added} bloco(s) importado(s) da Hotbar para a paleta!`);
                        player.playSound("random.orb", { pitch: 1.2, volume: 0.8 });
                    }
                    else {
                        MessageUtils.sendErrorMessage(player, "Nenhum bloco novo válido encontrado na Hotbar.");
                        player.playSound("note.bass", { pitch: 0.8, volume: 0.8 });
                    }
                    await this.openPaletteMenu(player);
                }
            }
        ];
        if (palette.length > 0) {
            entries.push({
                label: "§bAjustar Pesos (%) dos Blocos",
                icon: ICON_SETTINGS,
                action: async () => {
                    await this.openPaletteWeightsModal(player, palette);
                }
            });
        }
        entries.push({
            label: "§ePaletas Favoritas (3 Slots Salvos)",
            icon: ICON_PALETTE,
            action: async () => {
                await this.openSavedPalettesMenu(player);
            }
        });
        for (const bt of palette) {
            const pct = percentages[bt] ?? 0;
            entries.push({
                label: `§cRemover: §f${BlockUtils.getReadableBlockName(bt)} §7(${pct}%)`,
                icon: ICON_CLEAR,
                action: async () => {
                    PlayerPatternSettings.removeFromPalette(player.name, bt);
                    HoloPreviewEngine.clearAllPreviews(player);
                    PlayerUtils.updatePlayerHotbarMessage(player);
                    MessageUtils.sendMessage(player, `§eRemovido §f${BlockUtils.getReadableBlockName(bt)} §eda paleta.`);
                    await this.openPaletteMenu(player);
                }
            });
        }
        if (palette.length > 0) {
            entries.push({
                label: "§4Esvaziar Toda a Paleta",
                icon: ICON_CLEAR,
                action: async () => {
                    PlayerPatternSettings.clearPalette(player.name);
                    HoloPreviewEngine.clearAllPreviews(player);
                    PlayerUtils.updatePlayerHotbarMessage(player);
                    MessageUtils.sendSuccessMessage(player, "Paleta esvaziada.");
                    await this.openPaletteMenu(player);
                }
            });
        }
        entries.push({
            label: "§8Voltar ao Painel de Construção",
            icon: ICON_BACK,
            action: async () => {
                await this.openConstructionMenu(player);
            }
        });
        const form = new ActionFormData()
            .title(`§l§2PALETA DO ARQUITETO (${palette.length}/${maxPal})`)
            .body(bodyLines);
        for (const e of entries)
            form.button(e.label, e.icon);
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined)
            return;
        const chosen = entries[response.selection];
        if (chosen)
            await chosen.action();
    }
    static async openPaletteWeightsModal(player, palette) {
        const modal = new ModalFormData().title("§l§bPESOS DA PALETA (1 A 10)");
        for (const bt of palette) {
            const cur = PlayerPatternSettings.getBlockWeight(player.name, bt);
            modal.slider(`Peso: ${BlockUtils.getReadableBlockName(bt)}`, 1, 10, 1, cur);
        }
        const res = await modal.show(player);
        if (!res.canceled && res.formValues) {
            for (let i = 0; i < palette.length; i++) {
                const val = Number(res.formValues[i] ?? 5);
                PlayerPatternSettings.setBlockWeight(player.name, palette[i], val);
            }
            MessageUtils.sendSuccessMessage(player, "Proporções (%) da paleta atualizadas!");
            player.playSound("random.orb", { pitch: 1.2, volume: 0.7 });
        }
        await this.openPaletteMenu(player);
    }
    static async openSavedPalettesMenu(player) {
        const heldItem = InventoryUtils.getHeldItem(player);
        const maxPal = heldItem ? StaffConfig.getMaxPaletteSize(heldItem.typeId) : 6;
        const curPalette = PlayerPatternSettings.getPalette(player.name, maxPal);
        const saved = PlayerPatternSettings.getSavedPalettes(player.name);
        const body = saved.map((s, idx) => s ? `§eSlot ${idx + 1}: §f${s.name} §7(${s.blocks.length} blocos)` : `§8Slot ${idx + 1}: Vazio`).join("\n");
        const entries = [];
        for (let i = 0; i < 3; i++) {
            const slot = saved[i];
            if (slot) {
                entries.push({
                    label: `§aCarregar Slot ${i + 1}: §f${slot.name}`,
                    icon: ICON_PALETTE,
                    action: async () => {
                        const loaded = PlayerPatternSettings.loadPaletteSlot(player.name, i, maxPal);
                        HoloPreviewEngine.clearAllPreviews(player);
                        PlayerUtils.updatePlayerHotbarMessage(player);
                        if (loaded) {
                            MessageUtils.sendSuccessMessage(player, `Paleta '${loaded.name}' carregada e ativada!`);
                            player.playSound("random.levelup", { pitch: 1.2, volume: 0.7 });
                        }
                        await this.openPaletteMenu(player);
                    }
                });
            }
            if (curPalette.length > 0) {
                entries.push({
                    label: `§eSalvar Paleta Atual no Slot ${i + 1}`,
                    icon: ICON_SETTINGS,
                    action: async () => {
                        const modal = await new ModalFormData()
                            .title(`§l§eSALVAR PALETA NO SLOT ${i + 1}`)
                            .textField("Nome da Paleta", "Ex: Muro Medieval Musgoso", slot?.name ?? `Paleta ${i + 1}`)
                            .show(player);
                        if (!modal.canceled && modal.formValues) {
                            const name = String(modal.formValues[0] ?? "").slice(0, 28);
                            PlayerPatternSettings.savePaletteSlot(player.name, i, name, maxPal);
                            MessageUtils.sendSuccessMessage(player, `Paleta salva no Slot ${i + 1}!`);
                            player.playSound("random.orb", { pitch: 1.25, volume: 0.8 });
                        }
                        await this.openSavedPalettesMenu(player);
                    }
                });
            }
            if (slot) {
                entries.push({
                    label: `§cApagar Slot ${i + 1}`,
                    icon: ICON_CLEAR,
                    action: async () => {
                        PlayerPatternSettings.deletePaletteSlot(player.name, i);
                        MessageUtils.sendMessage(player, `§eSlot ${i + 1} de paleta apagado.`);
                        await this.openSavedPalettesMenu(player);
                    }
                });
            }
        }
        entries.push({
            label: "§8Voltar à Paleta",
            icon: ICON_BACK,
            action: async () => {
                await this.openPaletteMenu(player);
            }
        });
        const form = new ActionFormData()
            .title("§l§ePALETAS FAVORITAS (3 SLOTS)")
            .body(body);
        for (const e of entries)
            form.button(e.label, e.icon);
        const res = await form.show(player);
        if (res.canceled || res.selection === undefined)
            return;
        const chosen = entries[res.selection];
        if (chosen)
            await chosen.action();
    }
    static async openConstructionSettings(player, pattern) {
        switch (pattern) {
            case "connected":
                await this.openConnectedSettings(player);
                break;
            case "line":
                await this.openLineSettings(player);
                break;
            case "floor":
                await this.openFloorSettings(player);
                break;
            case "stairs":
                await this.openStairsSettings(player);
                break;
            case "overlay":
                await this.openOverlaySettings(player);
                break;
            case "wall":
                await this.openWallSettings(player);
                break;
            case "spiral":
                await this.openSpiralSettings(player);
                break;
            case "box2p":
                await this.openBox2PSettings(player);
                break;
            case "arch":
                await this.openArchSettings(player);
                break;
            case "gable_roof":
                await this.openGableRoofSettings(player);
                break;
            case "circle":
                await this.openCircleSettings(player);
                break;
            case "cylinder":
                await this.openCylinderSettings(player);
                break;
            case "sphere":
                await this.openSphereSettings(player);
                break;
            case "dome":
                await this.openDomeSettings(player);
                break;
            case "torus":
                await this.openTorusSettings(player);
                break;
            case "cube":
                await this.openCubeSettings(player);
                break;
            case "pyramid":
                await this.openPyramidSettings(player);
                break;
        }
    }
    static async openBox2PSettings(player) {
        const settings = PlayerPatternSettings.getBox2PSettings(player.name);
        const styles = ["filled", "hollow", "frame"];
        const curIdx = Math.max(0, styles.indexOf(settings.fillStyle ?? "filled"));
        const hasP1 = RegionEngine.hasPos1(player.name, player.dimension.id, "construction");
        const response = await new ModalFormData()
            .title("§l§3CAIXA DE 2 PONTOS (POS1 → POS2)")
            .dropdown("Estilo da Estrutura", [
            "Maciça (Bloco Sólido Preenchido)",
            "Oca (6 Faces: Paredes, Piso e Teto)",
            "Moldura / Vigas (Apenas as 12 Arestas!)"
        ], curIdx)
            .toggle("Limpar Ponto 1 marcado atualmente", hasP1)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setBox2PSettings(player.name, {
            fillStyle: styles[response.formValues[0]] ?? "filled"
        });
        if (response.formValues[1] === true) {
            RegionEngine.clearPos1(player.name);
        }
        HoloPreviewEngine.clearAllPreviews(player);
        PlayerUtils.updatePlayerHotbarMessage(player);
        MessageUtils.sendSuccessMessage(player, "Caixa 2P pronta! Com um bloco selecionado, clique no Ponto 1 e depois no Ponto 2.");
        if (response.formValues[2] === true)
            await this.openMainMenu(player);
    }
    static async openOverlaySettings(player) {
        const settings = PlayerPatternSettings.getOverlaySettings(player.name);
        const maxSize = this.getMaxSize(player);
        const modes = ["cover", "fill_holes", "smooth"];
        const curIdx = Math.max(0, modes.indexOf(settings.mode ?? "cover"));
        const response = await new ModalFormData()
            .title("§l§2PAISAGISMO / REVESTIR TERRENO")
            .dropdown("Modo de Paisagismo", [
            "Revestir Relevo (Cobre Colinas/Montanhas)",
            "Tapar Buracos (Nivela Depressões até a Altura Alvo)",
            "Suavizar Ladeiras / Colinas Naturais (Smooth)"
        ], curIdx)
            .slider("Raio de Alcance", 1, maxSize, 1, Math.min(settings.radius, maxSize))
            .slider("Espessura de Camadas", 1, 3, 1, Math.min(Math.max(1, settings.thickness), 3))
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setOverlaySettings(player.name, {
            mode: modes[response.formValues[0]] ?? "cover",
            radius: response.formValues[1],
            thickness: response.formValues[2]
        });
        HoloPreviewEngine.clearAllPreviews(player);
        PlayerUtils.updatePlayerHotbarMessage(player);
        if (response.formValues[3] === true)
            await this.openMainMenu(player);
    }
    static async openDestructionMenu(player) {
        const current = PlayerPatternSettings.getDestructionPattern(player.name);
        const matchSim = PlayerPatternSettings.isMatchSimilarBlocks(player.name);
        const simLabel = matchSim
            ? "§aAgrupar Rochas/Terras Similares: §fSIM"
            : "§8Agrupar Rochas/Terras Similares: NÃO";
        const form = new ActionFormData()
            .title("§l§4PAINEL DE DEMOLIÇÃO")
            .body(`§8Formato: §f${MessageUtils.getPatternLabel(current)} §8| Similares: ${matchSim ? "§aSIM" : "§8NÃO"}\n` +
            `§7Inclui Escavação de Túnel, Caixa 2 Pontos e Limpeza de Vegetação/Neve!`)
            .button("§cLimpar Seleção", ICON_CLEAR)
            .button(current === "connected" ? "§a> Conectado <" : "§8Conectado", PATTERN_ICONS.connected)
            .button(current === "area" ? "§a> Demolir Área <" : "§8Demolir Área", PATTERN_ICONS.area)
            .button(current === "tunnel" ? "§a> Escavar Túnel <" : "§8Escavar Túnel", PATTERN_ICONS.tunnel)
            .button(current === "box2p" ? "§a> Caixa 2 Pontos (Pos1→Pos2) <" : "§8Caixa 2 Pontos (Pos1→Pos2)", PATTERN_ICONS.box2p)
            .button(current === "foliage" ? "§a> Limpar Vegetação / Neve <" : "§8Limpar Vegetação / Neve", PATTERN_ICONS.foliage)
            .button(simLabel, ICON_RANDOMIZER)
            .button("§8Voltar ao Painel Principal", ICON_BACK);
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined)
            return;
        if (response.selection === 0) {
            RegionEngine.clearPos1(player.name);
            BlockSelectionManager.clearSelection(player.name);
            HoloPreviewEngine.unfreezePreview(player.name);
            HoloPreviewEngine.clearAllPreviews(player);
            PlayerUtils.updatePlayerHotbarMessage(player);
            await this.openDestructionMenu(player);
        }
        else if (response.selection >= 1 && response.selection <= 5) {
            const patterns = ["connected", "area", "tunnel", "box2p", "foliage"];
            const selected = patterns[response.selection - 1];
            RegionEngine.clearPos1(player.name);
            PlayerPatternSettings.setDestructionPattern(player.name, selected);
            HoloPreviewEngine.unfreezePreview(player.name);
            HoloPreviewEngine.clearAllPreviews(player);
            PlayerUtils.updatePlayerHotbarMessage(player);
            await this.openDestructionSettings(player, selected);
        }
        else if (response.selection === 6) {
            PlayerPatternSettings.setMatchSimilarBlocks(player.name, !matchSim);
            HoloPreviewEngine.clearAllPreviews(player);
            PlayerUtils.updatePlayerHotbarMessage(player);
            await this.openDestructionMenu(player);
        }
        else if (response.selection === 7) {
            await this.openMainMenu(player);
        }
    }
    static async openDestructionSettings(player, pattern) {
        this.sendPatternConfirmation(player, pattern);
        if (pattern === "area") {
            await this.openAreaDestroySettings(player);
        }
        else if (pattern === "tunnel") {
            await this.openTunnelDestroySettings(player);
        }
        else if (pattern === "foliage") {
            await this.openFoliageDestroySettings(player);
        }
        else if (pattern === "box2p") {
            MessageUtils.sendSuccessMessage(player, "Selecione o tipo de bloco alvo e clique no Ponto 1 e Ponto 2 para demolir na caixa!");
        }
        else {
            await this.openConnectedSettings(player);
        }
    }
    static async openFoliageDestroySettings(player) {
        const settings = PlayerPatternSettings.getFoliageDestroySettings(player.name);
        const maxRadius = Math.max(4, this.getMaxReplace(player) + 3);
        const response = await new ModalFormData()
            .title("§l§2LIMPAR VEGETAÇÃO / NEVE")
            .slider("Raio de Limpeza", 2, maxRadius, 1, Math.min(Math.max(2, settings.radius), maxRadius))
            .toggle("Incluir Folhas de Árvores", settings.includeLeaves)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setFoliageDestroySettings(player.name, {
            radius: response.formValues[0],
            includeLeaves: response.formValues[1]
        });
        HoloPreviewEngine.clearAllPreviews(player);
        PlayerUtils.updatePlayerHotbarMessage(player);
        if (response.formValues[2] === true)
            await this.openMainMenu(player);
    }
    static async openReplaceMenu(player) {
        const settings = PlayerPatternSettings.getReplaceSettings(player.name);
        const currentMode = PlayerPatternSettings.getReplaceMode(player.name);
        const specialText = settings.weatheringMode
            ? "§aModo Envelhecer Ruína ATIVO"
            : settings.usePalette
                ? "§aPincel de Texturização (Paleta %) ATIVO"
                : "§7Troca Direta (1 Bloco Alvo → 1 Substituto)";
        const form = new ActionFormData()
            .title("§l§6PAINEL DE SUBSTITUIÇÃO")
            .body(`§8Estilo Atual: ${specialText}`)
            .button(currentMode === "connected" ? "§a> Conectado <" : "§8Conectado", PATTERN_ICONS.connected)
            .button(currentMode === "area" ? "§a> Área Esférica <" : "§8Área Esférica", PATTERN_ICONS.area)
            .button(currentMode === "box2p" ? "§a> Caixa 2 Pontos (Pos1→Pos2) <" : "§8Caixa 2 Pontos (Pos1→Pos2)", PATTERN_ICONS.box2p)
            .button(settings.usePalette ? "§aPincel de Texturização (Paleta %): SIM" : "§8Pincel de Texturização (Paleta %): NÃO", ICON_PAINT)
            .button(settings.weatheringMode ? "§2Envelhecer Ruína (Musgo/Rachado): SIM" : "§8Envelhecer Ruína (Musgo/Rachado): NÃO", ICON_PAINT)
            .button(settings.keepSelections ? "§eFixar Seleção: SIM" : "§8Fixar Seleção: NÃO", ICON_FREEZE)
            .button("§eDimensionar Modo / Área", ICON_AREA_EDIT)
            .button("§cLimpar Blocos / Ponto 1", ICON_CLEAR)
            .button("§8Voltar ao Painel Principal", ICON_BACK);
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined)
            return;
        if (response.selection < 3) {
            const modes = ["connected", "area", "box2p"];
            RegionEngine.clearPos1(player.name);
            PlayerPatternSettings.setReplaceMode(player.name, modes[response.selection]);
            HoloPreviewEngine.unfreezePreview(player.name);
            HoloPreviewEngine.clearAllPreviews(player);
            PlayerUtils.updatePlayerHotbarMessage(player);
            await this.openReplaceMenu(player);
        }
        else if (response.selection === 3) {
            const nextVal = !settings.usePalette;
            PlayerPatternSettings.setReplaceSettings(player.name, {
                usePalette: nextVal,
                weatheringMode: nextVal ? false : settings.weatheringMode
            });
            PlayerUtils.updatePlayerHotbarMessage(player);
            if (nextVal) {
                MessageUtils.sendSuccessMessage(player, "Pincel de Texturização ATIVADO! Selecione apenas o bloco alvo para repintar usando sua Paleta (%).");
            }
            await this.openReplaceMenu(player);
        }
        else if (response.selection === 4) {
            const nextVal = !settings.weatheringMode;
            PlayerPatternSettings.setReplaceSettings(player.name, {
                weatheringMode: nextVal,
                usePalette: nextVal ? false : settings.usePalette
            });
            PlayerUtils.updatePlayerHotbarMessage(player);
            if (nextVal) {
                MessageUtils.sendSuccessMessage(player, "Modo Envelhecer Ruína ATIVADO! Clique em muros/pisos de pedra, tijolos ou ardósia para adicionar musgo e rachaduras.");
            }
            await this.openReplaceMenu(player);
        }
        else if (response.selection === 5) {
            PlayerPatternSettings.setReplaceSettings(player.name, { keepSelections: !settings.keepSelections });
            await this.openReplaceMenu(player);
        }
        else if (response.selection === 6) {
            if (currentMode === "connected") {
                await this.openConnectedSettings(player);
            }
            else if (currentMode === "area") {
                await this.openReplaceSettings(player);
            }
            else {
                MessageUtils.sendMessage(player, "§eNa Caixa 2P, defina o bloco alvo, o substituto e clique nos 2 cantos opostos!");
                await this.openReplaceMenu(player);
            }
        }
        else if (response.selection === 7) {
            RegionEngine.clearPos1(player.name);
            PlayerPatternSettings.clearReplaceBlocks(player.name);
            HoloPreviewEngine.clearAllPreviews(player);
            PlayerUtils.updatePlayerHotbarMessage(player);
            MessageUtils.sendMessage(player, "§eSeleções de substituição limpas.");
            await this.openReplaceMenu(player);
        }
        else if (response.selection === 8) {
            await this.openMainMenu(player);
        }
    }
    static async openLineSettings(player) {
        const heldItem = InventoryUtils.getHeldItem(player);
        const maxBlocks = heldItem ? StaffConfig.maxBlocks[heldItem.typeId] || 80 : 80;
        const settings = PlayerPatternSettings.getLineSettings(player.name);
        const snapValues = ["free", "cardinal", "diagonal"];
        const snapIdx = Math.max(0, snapValues.indexOf(settings.snap ?? "free"));
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR LINHA")
            .slider("Comprimento Máximo", 1, maxBlocks, 1, Math.min(settings.maxLength, maxBlocks))
            .dropdown("Alinhamento da Linha", ["Livre (Direção da Mira)", "Reto nos Eixos [90°]", "Diagonal Perfeita [45°]"], snapIdx)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setLineSettings(player.name, {
            maxLength: response.formValues[0],
            snap: snapValues[response.formValues[1]] ?? "free"
        });
        HoloPreviewEngine.clearAllPreviews(player);
        PlayerUtils.updatePlayerHotbarMessage(player);
        if (response.formValues[2] === true)
            await this.openMainMenu(player);
    }
    static async openConnectedSettings(player) {
        const settings = PlayerPatternSettings.getConnectedSettings(player.name);
        const held = InventoryUtils.getHeldItem(player);
        const max = held ? StaffConfig.maxBlocks[held.typeId] || 80 : 80;
        const lockValues = ["free", "horizontal", "vertical"];
        const lockIdx = Math.max(0, lockValues.indexOf(settings.directionLock ?? "free"));
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR CONECTADO")
            .slider("Máximo de Blocos", 1, max, 1, Math.min(settings.maxBlocks, max))
            .dropdown("Trava de Direção", ["Livre (Toda Superfície)", "Apenas Horizontal [H]", "Apenas Vertical [V]"], lockIdx)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setConnectedSettings(player.name, {
            maxBlocks: response.formValues[0],
            directionLock: lockValues[response.formValues[1]] ?? "free"
        });
        HoloPreviewEngine.clearAllPreviews(player);
        PlayerUtils.updatePlayerHotbarMessage(player);
        if (response.formValues[2] === true)
            await this.openMainMenu(player);
    }
    static async openFloorSettings(player) {
        const settings = PlayerPatternSettings.getFloorSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR PISO")
            .slider("Largura", 1, maxSize, 1, Math.min(settings.width, maxSize))
            .slider("Comprimento", 1, maxSize, 1, Math.min(settings.length, maxSize))
            .dropdown("Preenchimento", ["Plataforma Preenchida", "Moldura (Borda Vazada)"], settings.filled ? 0 : 1)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        const width = response.formValues[0];
        const length = response.formValues[1];
        PlayerPatternSettings.setFloorSettings(player.name, {
            width,
            length,
            filled: response.formValues[2] === 0
        });
        HoloPreviewEngine.clearAllPreviews(player);
        if (width * length > 120) {
            this.checkLagWarning(player, width * length, 120, "área de piso");
        }
        if (response.formValues[3] === true) {
            await this.openAdvancedSettings(player, "floor");
        }
        else if (response.formValues[4] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openStairsSettings(player) {
        const settings = PlayerPatternSettings.getStairsSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const maxSteps = Math.max(2, maxSize * 2);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR ESCADA / RAMPA")
            .slider("Largura da Escada", 1, maxSize, 1, Math.min(settings.width, maxSize))
            .slider("Quantidade de Degraus", 1, maxSteps, 1, Math.min(settings.steps, maxSteps))
            .dropdown("Direção", ["Subindo", "Descendo"], settings.direction === "up" ? 0 : 1)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setStairsSettings(player.name, {
            width: response.formValues[0],
            steps: response.formValues[1],
            direction: response.formValues[2] === 0 ? "up" : "down"
        });
        HoloPreviewEngine.clearAllPreviews(player);
        if (response.formValues[3] === true) {
            await this.openAdvancedSettings(player, "stairs");
        }
        else if (response.formValues[4] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openArchSettings(player) {
        const settings = PlayerPatternSettings.getArchSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const maxSpan = Math.max(3, maxSize * 2);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR ARCO / PONTE")
            .slider("Vão Livre (Largura)", 3, maxSpan, 1, Math.min(Math.max(3, settings.span), maxSpan))
            .slider("Altura do Arco", 2, Math.max(2, maxSize), 1, Math.min(Math.max(2, settings.height), Math.max(2, maxSize)))
            .slider("Profundidade (Ponte)", 1, maxSize, 1, Math.min(settings.depth, maxSize))
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setArchSettings(player.name, {
            span: response.formValues[0],
            height: response.formValues[1],
            depth: response.formValues[2]
        });
        HoloPreviewEngine.clearAllPreviews(player);
        if (response.formValues[3] === true) {
            await this.openAdvancedSettings(player, "arch");
        }
        else if (response.formValues[4] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openCircleSettings(player) {
        const settings = PlayerPatternSettings.getCircleSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const axisMap = ["horizontal", "vertical_x", "vertical_z"];
        const currentAxisIdx = axisMap.indexOf(settings.axis);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR CÍRCULO")
            .slider("Raio", 1, maxSize, 1, Math.min(settings.radius, maxSize))
            .dropdown("Eixo", ["Horizontal", "Vertical XY", "Vertical YZ"], currentAxisIdx >= 0 ? currentAxisIdx : 0)
            .dropdown("Formato", ["Anel (Vazado)", "Disco (Preenchido)"], settings.filled ? 1 : 0)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setCircleSettings(player.name, {
            radius: response.formValues[0],
            axis: axisMap[response.formValues[1]],
            filled: response.formValues[2] === 1
        });
        HoloPreviewEngine.clearAllPreviews(player);
        this.checkLagWarning(player, response.formValues[0], 10, "raio");
        if (response.formValues[3] === true) {
            await this.openAdvancedSettings(player, "circle");
        }
        else if (response.formValues[4] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openCylinderSettings(player) {
        const settings = PlayerPatternSettings.getCylinderSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR CILINDRO")
            .slider("Raio", 1, maxSize, 1, Math.min(settings.radius, maxSize))
            .slider("Altura", 1, maxSize, 1, Math.min(settings.height, maxSize))
            .dropdown("Tipo", ["Oco (Torre)", "Preenchido"], settings.type === "hollow" ? 0 : 1)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setCylinderSettings(player.name, {
            radius: response.formValues[0],
            height: response.formValues[1],
            type: response.formValues[2] === 0 ? "hollow" : "filled"
        });
        HoloPreviewEngine.clearAllPreviews(player);
        this.checkLagWarning(player, response.formValues[0], 9, "raio");
        if (response.formValues[3] === true) {
            await this.openAdvancedSettings(player, "cylinder");
        }
        else if (response.formValues[4] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openSphereSettings(player) {
        const settings = PlayerPatternSettings.getSphereSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR ESFERA")
            .slider("Raio", 1, maxSize, 1, Math.min(settings.radius, maxSize))
            .dropdown("Tipo", ["Oca", "Preenchida"], settings.type === "hollow" ? 0 : 1)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setSphereSettings(player.name, {
            radius: response.formValues[0],
            type: response.formValues[1] === 0 ? "hollow" : "filled"
        });
        HoloPreviewEngine.clearAllPreviews(player);
        this.checkLagWarning(player, response.formValues[0], 8, "raio");
        if (response.formValues[2] === true) {
            await this.openAdvancedSettings(player, "sphere");
        }
        else if (response.formValues[3] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openDomeSettings(player) {
        const settings = PlayerPatternSettings.getDomeSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR DOMO / CÚPULA")
            .slider("Raio da Cúpula", 1, maxSize, 1, Math.min(settings.radius, maxSize))
            .dropdown("Tipo", ["Oca (Abóbada)", "Preenchida"], settings.type === "hollow" ? 0 : 1)
            .toggle("Cúpula Invertida (Tigela)", settings.inverted)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setDomeSettings(player.name, {
            radius: response.formValues[0],
            type: response.formValues[1] === 0 ? "hollow" : "filled",
            inverted: response.formValues[2]
        });
        HoloPreviewEngine.clearAllPreviews(player);
        this.checkLagWarning(player, response.formValues[0], 9, "raio");
        if (response.formValues[3] === true) {
            await this.openAdvancedSettings(player, "dome");
        }
        else if (response.formValues[4] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openWallSettings(player) {
        const settings = PlayerPatternSettings.getWallSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR PAREDE")
            .slider("Largura", 1, maxSize, 1, Math.min(settings.width, maxSize))
            .slider("Altura", 1, maxSize, 1, Math.min(settings.height, maxSize))
            .slider("Espessura", 1, 3, 1, Math.min(settings.thickness, 3))
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setWallSettings(player.name, {
            width: response.formValues[0],
            height: response.formValues[1],
            thickness: response.formValues[2]
        });
        HoloPreviewEngine.clearAllPreviews(player);
        const width = response.formValues[0];
        const height = response.formValues[1];
        if (width * height > 100) {
            player.sendMessage("§6 Aviso: parede muito grande pode causar lag!");
            player.playSound("note.pling", { pitch: 0.8, volume: 0.5 });
        }
        if (response.formValues[3] === true) {
            await this.openAdvancedSettings(player, "wall");
        }
        else if (response.formValues[4] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openCubeSettings(player) {
        const settings = PlayerPatternSettings.getCubeSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR CUBO")
            .slider("Tamanho", 1, maxSize, 1, Math.min(settings.size, maxSize))
            .dropdown("Tipo", ["Oco", "Preenchido"], settings.type === "hollow" ? 0 : 1)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setCubeSettings(player.name, {
            size: response.formValues[0],
            type: response.formValues[1] === 0 ? "hollow" : "filled"
        });
        HoloPreviewEngine.clearAllPreviews(player);
        this.checkLagWarning(player, response.formValues[0], 8, "tamanho");
        if (response.formValues[2] === true) {
            await this.openAdvancedSettings(player, "cube");
        }
        else if (response.formValues[3] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openPyramidSettings(player) {
        const settings = PlayerPatternSettings.getPyramidSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR PIRÂMIDE")
            .slider("Tamanho da Base", 1, maxSize, 1, Math.min(settings.size, maxSize))
            .dropdown("Tipo", ["Oca (Telhado)", "Preenchida"], settings.type === "hollow" ? 0 : 1)
            .toggle("Pirâmide Invertida", settings.inverted)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setPyramidSettings(player.name, {
            size: response.formValues[0],
            type: response.formValues[1] === 0 ? "hollow" : "filled",
            inverted: response.formValues[2]
        });
        HoloPreviewEngine.clearAllPreviews(player);
        this.checkLagWarning(player, response.formValues[0], 11, "base");
        if (response.formValues[3] === true) {
            await this.openAdvancedSettings(player, "pyramid");
        }
        else if (response.formValues[4] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openSpiralSettings(player) {
        const settings = PlayerPatternSettings.getSpiralSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const maxHeight = Math.max(4, maxSize * 2);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR ESCADA EM ESPIRAL")
            .slider("Raio da Espiral", 2, maxSize, 1, Math.min(Math.max(2, settings.radius), maxSize))
            .slider("Altura Total (Andares)", 3, maxHeight, 1, Math.min(Math.max(3, settings.height), maxHeight))
            .slider("Largura do Degrau", 1, 4, 1, Math.min(Math.max(1, settings.stepWidth), 4))
            .toggle("Coluna Central de Sustentação", settings.centerPillar)
            .dropdown("Sentido de Rotação", ["Horário (Direita)", "Anti-Horário (Esquerda)"], settings.clockwise ? 0 : 1)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setSpiralSettings(player.name, {
            radius: response.formValues[0],
            height: response.formValues[1],
            stepWidth: response.formValues[2],
            centerPillar: response.formValues[3],
            clockwise: response.formValues[4] === 0
        });
        HoloPreviewEngine.clearAllPreviews(player);
        if (response.formValues[5] === true) {
            await this.openAdvancedSettings(player, "spiral");
        }
        else if (response.formValues[6] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openGableRoofSettings(player) {
        const settings = PlayerPatternSettings.getGableRoofSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const maxSpan = Math.max(3, maxSize * 2);
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR TELHADO DE 2 ÁGUAS")
            .slider("Largura Total (Vão)", 3, maxSpan, 1, Math.min(Math.max(3, settings.width), maxSpan))
            .slider("Comprimento do Telhado", 2, maxSpan, 1, Math.min(Math.max(2, settings.length), maxSpan))
            .dropdown("Estrutura Interna", ["Oca (Apenas Telhas/Águas)", "Preenchida (Sótão Maciço)"], settings.type === "hollow" ? 0 : 1)
            .toggle("Fechar Oitões (Triângulos Frontais/Traseiros)", settings.closeGables)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setGableRoofSettings(player.name, {
            width: response.formValues[0],
            length: response.formValues[1],
            type: response.formValues[2] === 0 ? "hollow" : "filled",
            closeGables: response.formValues[3]
        });
        HoloPreviewEngine.clearAllPreviews(player);
        if (response.formValues[4] === true) {
            await this.openAdvancedSettings(player, "gable_roof");
        }
        else if (response.formValues[5] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openTorusSettings(player) {
        const settings = PlayerPatternSettings.getTorusSettings(player.name);
        const maxSize = this.getMaxSize(player);
        const axisMap = ["horizontal", "vertical_x", "vertical_z"];
        const curAxisIdx = Math.max(0, axisMap.indexOf(settings.axis));
        const response = await new ModalFormData()
            .title("§l§eAJUSTAR TOROIDE / ANEL 3D")
            .slider("Raio Principal (Anel)", 3, maxSize, 1, Math.min(Math.max(3, settings.majorRadius), maxSize))
            .slider("Espessura do Tubo (Raio Menor)", 1, Math.max(2, Math.floor(maxSize / 2)), 1, Math.min(Math.max(1, settings.tubeRadius), Math.max(2, Math.floor(maxSize / 2))))
            .dropdown("Orientação do Anel", ["Horizontal (Deitado)", "Vertical XY (Portal)", "Vertical YZ (Lateral)"], curAxisIdx)
            .dropdown("Preenchimento", ["Oco (Casca Tubular)", "Maciço (Sólido)"], settings.hollow ? 0 : 1)
            .toggle("Simetria e Repetição", false)
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setTorusSettings(player.name, {
            majorRadius: response.formValues[0],
            tubeRadius: response.formValues[1],
            axis: axisMap[response.formValues[2]] ?? "horizontal",
            hollow: response.formValues[3] === 0
        });
        HoloPreviewEngine.clearAllPreviews(player);
        this.checkLagWarning(player, response.formValues[0], 9, "raio principal");
        if (response.formValues[4] === true) {
            await this.openAdvancedSettings(player, "torus");
        }
        else if (response.formValues[5] === true) {
            await this.openMainMenu(player);
        }
    }
    static async openAdvancedSettings(player, pattern) {
        const repeat = PlayerPatternSettings.getRepeatSettings(player.name);
        const mirror = PlayerPatternSettings.getMirrorSettings(player.name);
        const axisValues = ["x", "y", "z", "xz"];
        const axisLabels = ["Eixo X", "Eixo Y (Vertical)", "Eixo Z", "Quádruplo X + Z (4 Quadrantes)"];
        const currentAxisIdx = Math.max(0, axisValues.indexOf(mirror.axis));
        const anchorStr = mirror.worldAnchor
            ? `(${mirror.worldAnchor.x}, ${mirror.worldAnchor.y}, ${mirror.worldAnchor.z})`
            : "Não definido";
        const response = await new ModalFormData()
            .title("§l§9SIMETRIA E REPETIÇÃO")
            .toggle("Ativar Repetição", repeat.enabled)
            .slider("Quantidade de Repetições", 2, 5, 1, repeat.count)
            .slider("Espaçamento", 1, 10, 1, repeat.spacing)
            .toggle("Ativar Espelhamento", mirror.enabled)
            .dropdown("Eixo do Espelho", axisLabels, currentAxisIdx)
            .toggle(`Usar Marco Central Fixo no Mundo [${anchorStr}]`, Boolean(mirror.useWorldAnchor))
            .toggle("Gravar Minha Posição Atual como Novo Marco Central", false)
            .toggle("§8Voltar aos Ajustes do Formato", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setRepeatSettings(player.name, {
            enabled: response.formValues[0],
            count: response.formValues[1],
            spacing: response.formValues[2]
        });
        let newAnchor = mirror.worldAnchor ?? null;
        let useAnchor = response.formValues[5];
        if (response.formValues[6] === true) {
            newAnchor = {
                x: Math.floor(player.location.x),
                y: Math.floor(player.location.y),
                z: Math.floor(player.location.z)
            };
            useAnchor = true;
            MessageUtils.sendSuccessMessage(player, `Marco Central de Simetria gravado em (${newAnchor.x}, ${newAnchor.y}, ${newAnchor.z})!`);
        }
        PlayerPatternSettings.setMirrorSettings(player.name, {
            enabled: response.formValues[3],
            axis: axisValues[response.formValues[4]] ?? "x",
            useWorldAnchor: useAnchor,
            worldAnchor: newAnchor
        });
        HoloPreviewEngine.clearAllPreviews(player);
        if (response.formValues[7] === true) {
            await this.openConstructionSettings(player, pattern);
        }
    }
    static async openMaterialCalculator(player) {
        const mode = PlayerPatternSettings.getMode(player.name);
        const heldItem = InventoryUtils.getHeldItem(player);
        const staffId = heldItem?.typeId || "";
        const maxPal = StaffConfig.getMaxPaletteSize(staffId);
        const isCreative = player.getGameMode() === GameMode.creative;
        const autoCraft = PlayerPatternSettings.isAutoCraftBlocks(player.name);
        const reqMap = new Map();
        let totalBlocks = 0;
        let sourceTitle = "";
        if (mode === "blueprint" && BlueprintEngine.hasActiveBlueprint(player.name)) {
            const cb = BlueprintEngine.getOrCreateClipboard(player.name);
            sourceTitle = `Planta: §d${cb.name} §7(${cb.width}x${cb.height}x${cb.length})`;
            const bpReqs = BlueprintEngine.getRequiredMaterials(player.name);
            for (const [bt, cnt] of bpReqs.entries()) {
                reqMap.set(bt, cnt);
                totalBlocks += cnt;
            }
        }
        else {
            const frozenData = HoloPreviewEngine.frozenPreviews.get(player.name);
            const previewLocs = frozenData?.positions ?? HoloPreviewEngine.previews.get(player.name) ?? [];
            totalBlocks = previewLocs.length;
            const activePattern = mode === "construction"
                ? PlayerPatternSettings.getConstructionPattern(player.name)
                : mode === "destruction"
                    ? PlayerPatternSettings.getDestructionPattern(player.name)
                    : PlayerPatternSettings.getReplaceMode(player.name);
            sourceTitle = `${this.getModeBodyText(mode)} §8• §f${MessageUtils.getPatternLabel(activePattern)}`;
            if (totalBlocks > 0 && (mode === "construction" || mode === "replace")) {
                const isRand = mode === "construction"
                    ? PlayerPatternSettings.isRandomizerActive(player.name)
                    : Boolean(PlayerPatternSettings.getReplaceSettings(player.name).usePalette);
                const palette = PlayerPatternSettings.getPalette(player.name, maxPal);
                if (isRand && palette.length > 0) {
                    const pcts = PlayerPatternSettings.getPalettePercentages(player.name, maxPal);
                    for (const bt of palette) {
                        const pct = pcts[bt] ?? Math.round(100 / palette.length);
                        const est = Math.max(1, Math.round((totalBlocks * pct) / 100));
                        reqMap.set(bt, est);
                    }
                }
                else {
                    const sel = mode === "replace"
                        ? PlayerPatternSettings.getReplaceSettings(player.name).replaceBlock
                        : BlockSelectionManager.getSelection(player.name)?.blockType;
                    if (sel) {
                        reqMap.set(sel, totalBlocks);
                    }
                }
            }
        }
        const packs = Math.floor(totalBlocks / 64);
        const rem = totalBlocks % 64;
        const packText = packs > 0 ? `${packs} pack(s) de 64 + ${rem} un.` : `${totalBlocks} unidade(s)`;
        const durCost = isCreative ? 0 : Math.min(totalBlocks, 10);
        const matLines = [];
        for (const [bt, needed] of reqMap.entries()) {
            const have = InventoryUtils.countItemsInInventory(player, bt);
            const missing = Math.max(0, needed - have);
            const status = isCreative || missing === 0
                ? `§aOK (Estoque: ${have})`
                : `§cFaltam ${missing} §7(Tem: ${have})`;
            matLines.push(`§f• ${needed}x §e${BlockUtils.getReadableBlockName(bt)} §8— ${status}`);
        }
        const body = `§bProjeto Analisado: ${sourceTitle}\n` +
            `§bTotal de Blocos no Holograma/Planta: §f${totalBlocks} §7(${packText})\n` +
            `§bCusto Estimado de Durabilidade: §f${durCost} pts\n` +
            `§bBancada Automática (Auto-Craft): ${autoCraft ? "§aATIVA" : "§8DESLIGADA"}\n\n` +
            (matLines.length > 0
                ? `§6Lista de Compras / Estoque (Inventário + Baú${autoCraft ? " + Auto-Craft" : ""}):\n` + matLines.join("\n")
                : totalBlocks === 0
                    ? "§eDica: §7Aponte para um bloco (ou trave o Holograma no menu) antes de abrir a Calculadora para orçar qualquer obra em tempo real!"
                    : "§7Nenhum bloco de construção exigido para esta operação.");
        const form = new ActionFormData()
            .title("§l§3CALCULADORA DE OBRA")
            .body(body)
            .button("§aEnviar Orçamento no Chat", ICON_CALC)
            .button("§8Voltar ao Painel Principal", ICON_BACK);
        const res = await form.show(player);
        if (res.canceled || res.selection === undefined)
            return;
        if (res.selection === 0) {
            player.sendMessage(`§b§l[Orçamento do Arquiteto] §r${sourceTitle}: §f${totalBlocks} blocos §7(${packText})`);
            for (const line of matLines) {
                player.sendMessage(`  ${line}`);
            }
            player.playSound("random.orb", { pitch: 1.2, volume: 0.8 });
        }
        await this.openMainMenu(player);
    }
    static async openMasteryProfile(player) {
        const stats = PlayerPatternSettings.getStats(player.name);
        const rank = PlayerPatternSettings.getMasteryRank(player.name);
        const ranksList = [
            { min: 0, label: "§7Aprendiz de Cantaria" },
            { min: 250, label: "§aConstrutor da Vila" },
            { min: 1000, label: "§bMestre de Obras" },
            { min: 3500, label: "§dEngenheiro Real" },
            { min: 10000, label: "§6Arquiteto Imperial" },
            { min: 25000, label: "§cGrão-Mestre Dimensional" },
            { min: 50000, label: "§5Lenda Astral do Arquiteto" }
        ];
        const nextInfo = rank.nextThreshold
            ? `§ePróximo Título em: §f${rank.nextThreshold - rank.totalScore} blocos §7(${rank.totalScore}/${rank.nextThreshold})`
            : `§6§lNÍVEL MÁXIMO ALCANÇADO!`;
        const ranksText = ranksList.map((r, idx) => {
            const unlocked = rank.totalScore >= r.min;
            const isCurrent = (idx + 1) === rank.level;
            return `${unlocked ? "§a✔" : "§8🔒"} ${r.label} §8(${r.min}+ bl)${isCurrent ? " §e◄ ATUAL" : ""}`;
        }).join("\n");
        const body = `§6Arquiteto: §f${player.name}\n` +
            `§6Patente Atual: ${rank.color}§l${rank.title} §r§7(Nível ${rank.level}/7)\n` +
            `${nextInfo}\n\n` +
            `§bEstatísticas Históricas:\n` +
            `§a• Blocos Construídos: §f${stats.blocksBuilt}\n` +
            `§c• Blocos Escavados/Demolidos: §f${stats.blocksDestroyed}\n` +
            `§e• Blocos Substituídos/Pintados: §f${stats.blocksReplaced}\n` +
            `§d• Plantas e Prefabs Colados: §f${stats.blueprintsPasted}\n` +
            `§f• Total de Blocos Manipulados: §b${rank.totalScore}\n\n` +
            `§6Hierarquia da Guilda dos Arquitetos:\n${ranksText}`;
        const form = new ActionFormData()
            .title("§l§6MAESTRIA DO ARQUITETO")
            .body(body)
            .button("§8Voltar ao Painel Principal", ICON_BACK);
        await form.show(player);
        await this.openMainMenu(player);
    }
    static async openAreaDestroySettings(player) {
        const settings = PlayerPatternSettings.getAreaDestroySettings(player.name);
        const maxReplace = this.getMaxReplace(player);
        const response = await new ModalFormData()
            .title("§l§eDEMOLIR ÁREA")
            .slider("Raio Esférico", 1, maxReplace, 1, Math.min(settings.radius, maxReplace))
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setAreaDestroySettings(player.name, { radius: response.formValues[0] });
        HoloPreviewEngine.clearAllPreviews(player);
        this.checkLagWarning(player, response.formValues[0], 8, "raio");
        if (response.formValues[1] === true)
            await this.openMainMenu(player);
    }
    static async openTunnelDestroySettings(player) {
        const settings = PlayerPatternSettings.getTunnelDestroySettings(player.name);
        const maxReplace = this.getMaxReplace(player);
        const maxW = Math.max(3, maxReplace * 2 - 1);
        const maxD = Math.max(3, maxReplace * 3);
        const response = await new ModalFormData()
            .title("§l§eESCAVAÇÃO DE TÚNEL")
            .slider("Largura do Túnel", 1, maxW, 1, Math.min(settings.width, maxW))
            .slider("Altura do Túnel", 1, maxW, 1, Math.min(settings.height, maxW))
            .slider("Profundidade", 1, maxD, 1, Math.min(settings.depth, maxD))
            .toggle("§8Voltar ao Painel", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setTunnelDestroySettings(player.name, {
            width: response.formValues[0],
            height: response.formValues[1],
            depth: response.formValues[2]
        });
        HoloPreviewEngine.clearAllPreviews(player);
        if (response.formValues[3] === true)
            await this.openMainMenu(player);
    }
    static async openReplaceSettings(player) {
        const settings = PlayerPatternSettings.getReplaceSettings(player.name);
        const maxArea = this.getMaxReplace(player);
        const currentArea = Math.min(settings.areaSize, maxArea);
        const response = await new ModalFormData()
            .title("§l§eRAIO DE SUBSTITUIÇÃO")
            .slider("Raio da Área", 1, maxArea, 1, currentArea)
            .toggle("§8Voltar ao Painel de Substituição", false)
            .show(player);
        if (response.canceled || !response.formValues)
            return;
        PlayerPatternSettings.setReplaceSettings(player.name, { areaSize: response.formValues[0] });
        HoloPreviewEngine.clearAllPreviews(player);
        this.checkLagWarning(player, response.formValues[0], 8, "raio");
        if (response.formValues[1] === true)
            await this.openReplaceMenu(player);
    }
    static getMaxSize(p) {
        const item = InventoryUtils.getHeldItem(p);
        return item ? StaffConfig.maxPatternSize[item.typeId] || 10 : 10;
    }
    static getMaxReplace(p) {
        const item = InventoryUtils.getHeldItem(p);
        return item ? StaffConfig.maxReplaceArea[item.typeId] || 5 : 5;
    }
}
