import { world, Player } from "@minecraft/server";
import {
    DEFAULT_PATTERN_CONFIG, PatternConfig, PreviewStyle,
    LineSettings, ConnectedSettings, FloorSettings, StairsSettings,
    ArchSettings, CircleSettings, CylinderSettings, SphereSettings,
    DomeSettings, WallSettings, CubeSettings, PyramidSettings,
    SpiralSettings, GableRoofSettings, TorusSettings, ArchitectStats,
    Box2PSettings, OverlaySettings, FoliageDestroySettings,
    AreaDestroySettings, TunnelDestroySettings, ReplaceSettings,
    RepeatSettings, MirrorSettings, SupplyChestLocation, SavedPalette
} from "./patternTypes";
import { MessageUtils } from "../messageUtils";

export interface MasteryRankInfo {
    level: number;
    title: string;
    color: string;
    totalScore: number;
    nextThreshold: number | null;
}

const MASTERY_RANKS: Array<{ min: number; title: string; color: string }> = [
    { min: 0,      title: "Aprendiz de Cantaria",       color: "§7" },
    { min: 250,    title: "Construtor da Vila",         color: "§a" },
    { min: 1000,   title: "Mestre de Obras",            color: "§2" },
    { min: 3500,   title: "Engenheiro Real",            color: "§b" },
    { min: 10000,  title: "Arquiteto Imperial",         color: "§6" },
    { min: 30000,  title: "Grão-Mestre Dimensional",    color: "§d" },
    { min: 75000,  title: "Lenda Astral do Arquiteto",  color: "§3" }
];

export const MAX_PALETTE_SIZE = 9;
const SETTINGS_PROPERTY_KEY = "arc_st:pattern_config";

export class PlayerPatternSettings {
    static configs: Map<string, PatternConfig> = new Map();

    private static mergeWithDefaults(parsed: Partial<PatternConfig>): PatternConfig {
        const base: PatternConfig = JSON.parse(JSON.stringify(DEFAULT_PATTERN_CONFIG));
        const rawSaved = Array.isArray(parsed.savedPalettes) ? parsed.savedPalettes : [];
        const savedPalettes: (SavedPalette | null)[] = [
            rawSaved[0] ?? null,
            rawSaved[1] ?? null,
            rawSaved[2] ?? null
        ];
        return {
            ...base,
            ...parsed,
            lineSettings: { ...base.lineSettings, ...(parsed.lineSettings ?? {}) },
            connectedSettings: { ...base.connectedSettings, ...(parsed.connectedSettings ?? {}) },
            floorSettings: { ...base.floorSettings, ...(parsed.floorSettings ?? {}) },
            stairsSettings: { ...base.stairsSettings, ...(parsed.stairsSettings ?? {}) },
            archSettings: { ...base.archSettings, ...(parsed.archSettings ?? {}) },
            circleSettings: { ...base.circleSettings, ...(parsed.circleSettings ?? {}) },
            cylinderSettings: { ...base.cylinderSettings, ...(parsed.cylinderSettings ?? {}) },
            sphereSettings: { ...base.sphereSettings, ...(parsed.sphereSettings ?? {}) },
            domeSettings: { ...base.domeSettings, ...(parsed.domeSettings ?? {}) },
            wallSettings: { ...base.wallSettings, ...(parsed.wallSettings ?? {}) },
            cubeSettings: { ...base.cubeSettings, ...(parsed.cubeSettings ?? {}) },
            pyramidSettings: { ...base.pyramidSettings, ...(parsed.pyramidSettings ?? {}) },
            spiralSettings: { ...base.spiralSettings, ...(parsed.spiralSettings ?? {}) },
            gableRoofSettings: { ...base.gableRoofSettings, ...(parsed.gableRoofSettings ?? {}) },
            torusSettings: { ...base.torusSettings, ...(parsed.torusSettings ?? {}) },
            box2pSettings: { ...base.box2pSettings, ...(parsed.box2pSettings ?? {}) },
            overlaySettings: { ...base.overlaySettings, ...(parsed.overlaySettings ?? {}) },
            areaDestroySettings: { ...base.areaDestroySettings, ...(parsed.areaDestroySettings ?? {}) },
            tunnelDestroySettings: { ...base.tunnelDestroySettings, ...(parsed.tunnelDestroySettings ?? {}) },
            foliageDestroySettings: { ...base.foliageDestroySettings, ...(parsed.foliageDestroySettings ?? {}) },
            replaceSettings: { ...base.replaceSettings, ...(parsed.replaceSettings ?? {}) },
            repeatSettings: { ...base.repeatSettings, ...(parsed.repeatSettings ?? {}) },
            mirrorSettings: { ...base.mirrorSettings, ...(parsed.mirrorSettings ?? {}) },
            palette: Array.isArray(parsed.palette) ? parsed.palette.slice(0, MAX_PALETTE_SIZE) : [],
            paletteWeights: (parsed.paletteWeights && typeof parsed.paletteWeights === "object") ? { ...parsed.paletteWeights } : {},
            savedPalettes,
            stats: { ...base.stats, ...(parsed.stats ?? {}) }
        };
    }

    static loadFromPlayer(player: Player): PatternConfig {
        try {
            const raw = player.getDynamicProperty(SETTINGS_PROPERTY_KEY);
            if (typeof raw === "string" && raw.length > 0) {
                const parsed = JSON.parse(raw) as Partial<PatternConfig>;
                const merged = this.mergeWithDefaults(parsed);
                this.configs.set(player.name, merged);
                return merged;
            }
        } catch { }
        return this.getConfig(player.name);
    }

    static saveForPlayerName(playerName: string): void {
        const config = this.configs.get(playerName);
        if (!config) return;
        try {
            const player = world.getAllPlayers().find(p => p.name === playerName);
            if (player) {
                player.setDynamicProperty(SETTINGS_PROPERTY_KEY, JSON.stringify(config));
            }
        } catch { }
    }

    static getConfig(playerName: string): PatternConfig {
        if (!this.configs.has(playerName)) {
            const player = world.getAllPlayers().find(p => p.name === playerName);
            if (player) {
                try {
                    const raw = player.getDynamicProperty(SETTINGS_PROPERTY_KEY);
                    if (typeof raw === "string" && raw.length > 0) {
                        const parsed = JSON.parse(raw) as Partial<PatternConfig>;
                        const merged = this.mergeWithDefaults(parsed);
                        this.configs.set(playerName, merged);
                        return merged;
                    }
                } catch { }
            }
            this.configs.set(playerName, JSON.parse(JSON.stringify(DEFAULT_PATTERN_CONFIG)));
        }
        return this.configs.get(playerName)!;
    }

    static setMode(playerName: string, mode: string): void {
        this.getConfig(playerName).mode = mode;
        this.saveForPlayerName(playerName);
    }

    static getMode(playerName: string): string {
        return this.getConfig(playerName).mode;
    }

    static setPreviewStyle(playerName: string, style: PreviewStyle): void {
        this.getConfig(playerName).previewStyle = style;
        this.saveForPlayerName(playerName);
    }

    static getPreviewStyle(playerName: string): PreviewStyle {
        return this.getConfig(playerName).previewStyle ?? "particles";
    }

    static setAutoAdjacentSlot(playerName: string, enabled: boolean): void {
        this.getConfig(playerName).autoAdjacentSlot = enabled;
        this.saveForPlayerName(playerName);
    }

    static isAutoAdjacentSlot(playerName: string): boolean {
        return this.getConfig(playerName).autoAdjacentSlot ?? false;
    }

    static setMatchSimilarBlocks(playerName: string, enabled: boolean): void {
        this.getConfig(playerName).matchSimilarBlocks = enabled;
        this.saveForPlayerName(playerName);
    }

    static isMatchSimilarBlocks(playerName: string): boolean {
        return this.getConfig(playerName).matchSimilarBlocks ?? false;
    }

    static setAutoOrientBlocks(playerName: string, enabled: boolean): void {
        this.getConfig(playerName).autoOrientBlocks = enabled;
        this.saveForPlayerName(playerName);
    }

    static isAutoOrientBlocks(playerName: string): boolean {
        return this.getConfig(playerName).autoOrientBlocks ?? true;
    }

    static setAutoCraftBlocks(playerName: string, enabled: boolean): void {
        this.getConfig(playerName).autoCraftBlocks = enabled;
        this.saveForPlayerName(playerName);
    }

    static isAutoCraftBlocks(playerName: string): boolean {
        return this.getConfig(playerName).autoCraftBlocks ?? true;
    }

    static setAutoTorch(playerName: string, enabled: boolean): void {
        this.getConfig(playerName).autoTorch = enabled;
        this.saveForPlayerName(playerName);
    }

    static isAutoTorch(playerName: string): boolean {
        return this.getConfig(playerName).autoTorch ?? false;
    }

    static setTorchSpacing(playerName: string, spacing: number): void {
        this.getConfig(playerName).torchSpacing = Math.max(3, Math.min(12, Math.round(spacing)));
        this.saveForPlayerName(playerName);
    }

    static getTorchSpacing(playerName: string): number {
        return this.getConfig(playerName).torchSpacing ?? 6;
    }

    static setSupplyChest(playerName: string, loc: SupplyChestLocation | null): void {
        this.getConfig(playerName).supplyChest = loc ? { ...loc } : null;
        this.saveForPlayerName(playerName);
    }

    static getSupplyChest(playerName: string): SupplyChestLocation | null {
        return this.getConfig(playerName).supplyChest ?? null;
    }

    static setConstructionPattern(playerName: string, pattern: string): void {
        this.getConfig(playerName).activeConstructionPattern = pattern;
        this.saveForPlayerName(playerName);
    }

    static getConstructionPattern(playerName: string): string {
        return this.getConfig(playerName).activeConstructionPattern;
    }

    static setDestructionPattern(playerName: string, pattern: string): void {
        this.getConfig(playerName).activeDestructionPattern = pattern;
        this.saveForPlayerName(playerName);
    }

    static getDestructionPattern(playerName: string): string {
        return this.getConfig(playerName).activeDestructionPattern;
    }

    static setReplaceMode(playerName: string, mode: string): void {
        this.getConfig(playerName).activeReplaceMode = mode;
        this.saveForPlayerName(playerName);
    }

    static getReplaceMode(playerName: string): string {
        return this.getConfig(playerName).activeReplaceMode;
    }

    static getLineSettings(playerName: string): LineSettings {
        return this.getConfig(playerName).lineSettings;
    }

    static setLineSettings(playerName: string, settings: Partial<LineSettings>): void {
        const c = this.getConfig(playerName);
        c.lineSettings = { ...c.lineSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getConnectedSettings(playerName: string): ConnectedSettings {
        return this.getConfig(playerName).connectedSettings;
    }

    static setConnectedSettings(playerName: string, settings: Partial<ConnectedSettings>): void {
        const c = this.getConfig(playerName);
        c.connectedSettings = { ...c.connectedSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getFloorSettings(playerName: string): FloorSettings {
        return this.getConfig(playerName).floorSettings;
    }

    static setFloorSettings(playerName: string, settings: Partial<FloorSettings>): void {
        const c = this.getConfig(playerName);
        c.floorSettings = { ...c.floorSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getStairsSettings(playerName: string): StairsSettings {
        return this.getConfig(playerName).stairsSettings;
    }

    static setStairsSettings(playerName: string, settings: Partial<StairsSettings>): void {
        const c = this.getConfig(playerName);
        c.stairsSettings = { ...c.stairsSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getArchSettings(playerName: string): ArchSettings {
        return this.getConfig(playerName).archSettings;
    }

    static setArchSettings(playerName: string, settings: Partial<ArchSettings>): void {
        const c = this.getConfig(playerName);
        c.archSettings = { ...c.archSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getCircleSettings(playerName: string): CircleSettings {
        return this.getConfig(playerName).circleSettings;
    }

    static setCircleSettings(playerName: string, settings: Partial<CircleSettings>): void {
        const c = this.getConfig(playerName);
        c.circleSettings = { ...c.circleSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getCylinderSettings(playerName: string): CylinderSettings {
        return this.getConfig(playerName).cylinderSettings;
    }

    static setCylinderSettings(playerName: string, settings: Partial<CylinderSettings>): void {
        const c = this.getConfig(playerName);
        c.cylinderSettings = { ...c.cylinderSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getSphereSettings(playerName: string): SphereSettings {
        return this.getConfig(playerName).sphereSettings;
    }

    static setSphereSettings(playerName: string, settings: Partial<SphereSettings>): void {
        const c = this.getConfig(playerName);
        c.sphereSettings = { ...c.sphereSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getDomeSettings(playerName: string): DomeSettings {
        return this.getConfig(playerName).domeSettings;
    }

    static setDomeSettings(playerName: string, settings: Partial<DomeSettings>): void {
        const c = this.getConfig(playerName);
        c.domeSettings = { ...c.domeSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getWallSettings(playerName: string): WallSettings {
        return this.getConfig(playerName).wallSettings;
    }

    static setWallSettings(playerName: string, settings: Partial<WallSettings>): void {
        const c = this.getConfig(playerName);
        c.wallSettings = { ...c.wallSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getCubeSettings(playerName: string): CubeSettings {
        return this.getConfig(playerName).cubeSettings;
    }

    static setCubeSettings(playerName: string, settings: Partial<CubeSettings>): void {
        const c = this.getConfig(playerName);
        c.cubeSettings = { ...c.cubeSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getPyramidSettings(playerName: string): PyramidSettings {
        return this.getConfig(playerName).pyramidSettings;
    }

    static setPyramidSettings(playerName: string, settings: Partial<PyramidSettings>): void {
        const c = this.getConfig(playerName);
        c.pyramidSettings = { ...c.pyramidSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getSpiralSettings(playerName: string): SpiralSettings {
        return this.getConfig(playerName).spiralSettings;
    }

    static setSpiralSettings(playerName: string, settings: Partial<SpiralSettings>): void {
        const c = this.getConfig(playerName);
        c.spiralSettings = { ...c.spiralSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getGableRoofSettings(playerName: string): GableRoofSettings {
        return this.getConfig(playerName).gableRoofSettings;
    }

    static setGableRoofSettings(playerName: string, settings: Partial<GableRoofSettings>): void {
        const c = this.getConfig(playerName);
        c.gableRoofSettings = { ...c.gableRoofSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getTorusSettings(playerName: string): TorusSettings {
        return this.getConfig(playerName).torusSettings;
    }

    static setTorusSettings(playerName: string, settings: Partial<TorusSettings>): void {
        const c = this.getConfig(playerName);
        c.torusSettings = { ...c.torusSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getBox2PSettings(playerName: string): Box2PSettings {
        return this.getConfig(playerName).box2pSettings;
    }

    static setBox2PSettings(playerName: string, settings: Partial<Box2PSettings>): void {
        const c = this.getConfig(playerName);
        c.box2pSettings = { ...c.box2pSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getOverlaySettings(playerName: string): OverlaySettings {
        return this.getConfig(playerName).overlaySettings;
    }

    static setOverlaySettings(playerName: string, settings: Partial<OverlaySettings>): void {
        const c = this.getConfig(playerName);
        c.overlaySettings = { ...c.overlaySettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getFoliageDestroySettings(playerName: string): FoliageDestroySettings {
        return this.getConfig(playerName).foliageDestroySettings;
    }

    static setFoliageDestroySettings(playerName: string, settings: Partial<FoliageDestroySettings>): void {
        const c = this.getConfig(playerName);
        c.foliageDestroySettings = { ...c.foliageDestroySettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getAreaDestroySettings(playerName: string): AreaDestroySettings {
        return this.getConfig(playerName).areaDestroySettings;
    }

    static setAreaDestroySettings(playerName: string, settings: Partial<AreaDestroySettings>): void {
        const c = this.getConfig(playerName);
        c.areaDestroySettings = { ...c.areaDestroySettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getTunnelDestroySettings(playerName: string): TunnelDestroySettings {
        return this.getConfig(playerName).tunnelDestroySettings;
    }

    static setTunnelDestroySettings(playerName: string, settings: Partial<TunnelDestroySettings>): void {
        const c = this.getConfig(playerName);
        c.tunnelDestroySettings = { ...c.tunnelDestroySettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getReplaceSettings(playerName: string): ReplaceSettings {
        return this.getConfig(playerName).replaceSettings;
    }

    static setReplaceSettings(playerName: string, settings: Partial<ReplaceSettings>): void {
        const c = this.getConfig(playerName);
        c.replaceSettings = { ...c.replaceSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getRepeatSettings(playerName: string): RepeatSettings {
        return this.getConfig(playerName).repeatSettings;
    }

    static setRepeatSettings(playerName: string, settings: Partial<RepeatSettings>): void {
        const c = this.getConfig(playerName);
        c.repeatSettings = { ...c.repeatSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getMirrorSettings(playerName: string): MirrorSettings {
        return this.getConfig(playerName).mirrorSettings;
    }

    static setMirrorSettings(playerName: string, settings: Partial<MirrorSettings>): void {
        const c = this.getConfig(playerName);
        c.mirrorSettings = { ...c.mirrorSettings, ...settings };
        this.saveForPlayerName(playerName);
    }

    static getPalette(playerName: string, maxLimit = 6): string[] {
        return this.getConfig(playerName).palette.slice(0, maxLimit);
    }

    static addToPalette(playerName: string, blockType: string, maxLimit = 6): { added: boolean; replaced?: string } {
        const cap = Math.min(maxLimit, MAX_PALETTE_SIZE);
        const c = this.getConfig(playerName);
        if (c.palette.slice(0, cap).includes(blockType)) return { added: false };
        if (c.palette.length > cap) {
            c.palette = c.palette.slice(0, cap);
        }
        if (c.palette.length < cap) {
            c.palette.push(blockType);
            this.saveForPlayerName(playerName);
            return { added: true };
        }
        const writeIdx = c.paletteWriteIndex % cap;
        const replaced = c.palette[writeIdx];
        c.palette[writeIdx] = blockType;
        c.paletteWriteIndex = (writeIdx + 1) % cap;
        this.saveForPlayerName(playerName);
        return { added: true, replaced };
    }

    static removeFromPalette(playerName: string, blockType: string): boolean {
        const c = this.getConfig(playerName);
        const idx = c.palette.indexOf(blockType);
        if (idx === -1) return false;
        c.palette.splice(idx, 1);
        c.paletteWriteIndex = 0;
        this.saveForPlayerName(playerName);
        return true;
    }

    static clearPalette(playerName: string): void {
        const c = this.getConfig(playerName);
        c.palette = [];
        c.paletteWeights = {};
        c.paletteWriteIndex = 0;
        this.saveForPlayerName(playerName);
    }

    static getBlockWeight(playerName: string, blockType: string): number {
        const w = this.getConfig(playerName).paletteWeights?.[blockType];
        if (typeof w !== "number" || isNaN(w)) return 5;
        return Math.max(1, Math.min(10, Math.round(w)));
    }

    static setBlockWeight(playerName: string, blockType: string, weight: number): void {
        const c = this.getConfig(playerName);
        if (!c.paletteWeights) c.paletteWeights = {};
        c.paletteWeights[blockType] = Math.max(1, Math.min(10, Math.round(weight)));
        this.saveForPlayerName(playerName);
    }

    static getPalettePercentages(playerName: string, maxLimit = 6): Record<string, number> {
        const pal = this.getPalette(playerName, maxLimit);
        const result: Record<string, number> = {};
        if (pal.length === 0) return result;
        const total = pal.reduce((sum, bt) => sum + this.getBlockWeight(playerName, bt), 0);
        if (total <= 0) {
            const eq = Math.round(100 / pal.length);
            pal.forEach(bt => { result[bt] = eq; });
            return result;
        }
        for (const bt of pal) {
            result[bt] = Math.round((this.getBlockWeight(playerName, bt) / total) * 100);
        }
        return result;
    }

    static pickWeightedBlock(playerName: string, candidates: string[]): string {
        if (candidates.length === 0) return "minecraft:stone";
        if (candidates.length === 1) return candidates[0];
        let total = 0;
        const weights = candidates.map(bt => {
            const w = this.getBlockWeight(playerName, bt);
            total += w;
            return w;
        });
        let roll = Math.random() * total;
        for (let i = 0; i < candidates.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return candidates[i];
        }
        return candidates[candidates.length - 1];
    }

    static getSavedPalettes(playerName: string): (SavedPalette | null)[] {
        const c = this.getConfig(playerName);
        if (!Array.isArray(c.savedPalettes) || c.savedPalettes.length < 3) {
            c.savedPalettes = [
                c.savedPalettes?.[0] ?? null,
                c.savedPalettes?.[1] ?? null,
                c.savedPalettes?.[2] ?? null
            ];
        }
        return c.savedPalettes;
    }

    static savePaletteSlot(playerName: string, slotIndex: number, name: string, maxLimit = 6): boolean {
        if (slotIndex < 0 || slotIndex > 2) return false;
        const blocks = this.getPalette(playerName, maxLimit);
        if (blocks.length === 0) return false;
        const weights: Record<string, number> = {};
        for (const bt of blocks) {
            weights[bt] = this.getBlockWeight(playerName, bt);
        }
        const slots = this.getSavedPalettes(playerName);
        slots[slotIndex] = {
            name: name.trim() || `Paleta ${slotIndex + 1}`,
            blocks: [...blocks],
            weights
        };
        this.saveForPlayerName(playerName);
        return true;
    }

    static loadPaletteSlot(playerName: string, slotIndex: number, maxLimit = 6): SavedPalette | null {
        if (slotIndex < 0 || slotIndex > 2) return null;
        const slot = this.getSavedPalettes(playerName)[slotIndex];
        if (!slot || slot.blocks.length === 0) return null;
        const c = this.getConfig(playerName);
        c.palette = slot.blocks.slice(0, Math.min(maxLimit, MAX_PALETTE_SIZE));
        c.paletteWeights = { ...(slot.weights ?? {}) };
        c.paletteWriteIndex = 0;
        c.randomizerActive = true;
        c.randomizerPending = false;
        this.saveForPlayerName(playerName);
        return slot;
    }

    static deletePaletteSlot(playerName: string, slotIndex: number): void {
        if (slotIndex < 0 || slotIndex > 2) return;
        const slots = this.getSavedPalettes(playerName);
        slots[slotIndex] = null;
        this.saveForPlayerName(playerName);
    }

    static getStats(playerName: string): ArchitectStats {
        const c = this.getConfig(playerName);
        if (!c.stats) {
            c.stats = { blocksBuilt: 0, blocksDestroyed: 0, blocksReplaced: 0, blueprintsPasted: 0 };
        }
        return c.stats;
    }

    static getMasteryRank(playerName: string): MasteryRankInfo {
        const s = this.getStats(playerName);
        const totalScore = (s.blocksBuilt || 0) + (s.blocksDestroyed || 0) + (s.blocksReplaced || 0);
        let level = 1;
        let current = MASTERY_RANKS[0];
        let nextThreshold: number | null = MASTERY_RANKS[1]?.min ?? null;

        for (let i = 0; i < MASTERY_RANKS.length; i++) {
            if (totalScore >= MASTERY_RANKS[i].min) {
                level = i + 1;
                current = MASTERY_RANKS[i];
                nextThreshold = MASTERY_RANKS[i + 1]?.min ?? null;
            }
        }
        return {
            level,
            title: current.title,
            color: current.color,
            totalScore,
            nextThreshold
        };
    }

    static recordStats(
        player: Player,
        kind: "built" | "destroyed" | "replaced" | "blueprint",
        count: number
    ): void {
        if (count <= 0) return;
        const beforeRank = this.getMasteryRank(player.name);
        const stats = this.getStats(player.name);
        if (kind === "built") stats.blocksBuilt += count;
        else if (kind === "destroyed") stats.blocksDestroyed += count;
        else if (kind === "replaced") stats.blocksReplaced += count;
        else if (kind === "blueprint") {
            stats.blocksBuilt += count;
            stats.blueprintsPasted += 1;
        }
        this.saveForPlayerName(player.name);

        const afterRank = this.getMasteryRank(player.name);
        if (afterRank.level > beforeRank.level) {
            MessageUtils.sendMessage(
                player,
                `§6§l★ SUBIU DE RANQUE! §r§eAgora você é ${afterRank.color}§l${afterRank.title} §r§7(Nível ${afterRank.level})!`
            );
            try {
                player.playSound("random.totem", { pitch: 1.15, volume: 0.75 });
                for (let i = 0; i < 10; i++) {
                    player.dimension.spawnParticle("minecraft:totem_particle", {
                        x: player.location.x + (Math.random() - 0.5) * 1.6,
                        y: player.location.y + 1.0 + Math.random() * 1.2,
                        z: player.location.z + (Math.random() - 0.5) * 1.6
                    });
                }
            } catch { }
        }
    }

    static setRandomizerActive(playerName: string, active: boolean): void {
        this.getConfig(playerName).randomizerActive = active;
        this.saveForPlayerName(playerName);
    }

    static isRandomizerActive(playerName: string): boolean {
        return this.getConfig(playerName).randomizerActive;
    }

    static setRandomizerPending(playerName: string, pending: boolean): void {
        this.getConfig(playerName).randomizerPending = pending;
        this.saveForPlayerName(playerName);
    }

    static isRandomizerPending(playerName: string): boolean {
        return this.getConfig(playerName).randomizerPending;
    }

    static clearReplaceBlocks(playerName: string): void {
        const c = this.getConfig(playerName);
        c.replaceSettings.findBlock = null;
        c.replaceSettings.replaceBlock = null;
        this.saveForPlayerName(playerName);
    }

    static resetConfig(playerName: string): void {
        this.configs.set(playerName, JSON.parse(JSON.stringify(DEFAULT_PATTERN_CONFIG)));
        this.saveForPlayerName(playerName);
    }

    static clearAll(): void {
        this.configs.clear();
    }
}
