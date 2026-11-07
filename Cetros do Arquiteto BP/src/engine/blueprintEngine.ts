import { world, system, BlockPermutation, Player, Vector3 } from "@minecraft/server";
import { BlockUtils } from "../api/blockUtils";
import { VectorUtils } from "../api/vectorUtils";
import { PatternEngine } from "./patternEngine";

const BLUEPRINTS_PROPERTY_KEY = "arc_st:blueprints";
const MAX_DYNAMIC_BYTES = 30000;

export interface BlueprintBlock {
    dx: number;
    dy: number;
    dz: number;
    typeId: string;
    states: Record<string, string | number | boolean>;
}

export interface BlueprintClipboard {
    name: string;
    blocks: BlueprintBlock[];
    width: number;
    height: number;
    length: number;
    rotation: 0 | 90 | 180 | 270;
    mirrorX: boolean;
    captureArmed: boolean;
}

interface CompactBlueprintSlot {
    n: string;
    w: number;
    h: number;
    l: number;
    d: string[];
    s: Record<string, string | number | boolean>[];
    b: [number, number, number, number, number][];
}

const RELEVANT_STATE_KEYS = [
    "weirdo_direction",
    "upside_down_bit",
    "minecraft:vertical_half",
    "minecraft:cardinal_direction",
    "minecraft:facing_direction",
    "facing_direction",
    "pillar_axis",
    "direction",
    "open_bit",
    "upper_block_bit"
];

export interface PrefabDefinition {
    id: string;
    name: string;
    dims: string;
    description: string;
}

export class BlueprintEngine {
    static readonly MAX_BLUEPRINT_BLOCKS = 500;
    static readonly PREFABS: PrefabDefinition[] = [
        { id: "watchtower",    name: "Torre de Vigia Medieval",      dims: "7x10x7", description: "Torre cilíndrica com ameias, janelas e escada interna" },
        { id: "arched_bridge", name: "Ponte Arqueada Clássica",      dims: "11x5x5", description: "Ponte parabólica com guarda-corpo e iluminação" },
        { id: "cozy_cabin",    name: "Chalé Compacto",               dims: "7x7x7",  description: "Cabana com piso, janelas, porta e telhado de 2 águas" },
        { id: "plaza_fountain",name: "Fonte Imperial de Praça",      dims: "7x5x7",  description: "Bacia octogonal com coluna central esculpida" },
        { id: "street_lamps",  name: "Poste Imperial Duplo",         dims: "5x6x3",  description: "Coluna monumental com braços duplos e lanternas" },
        { id: "nether_shrine", name: "Santuário de Portal",          dims: "9x8x5",  description: "Altar arqueado com moldura de portal integrada" }
    ];
    static copyPos1Map: Map<string, { pos: Vector3; dimensionId: string }> = new Map();
    static clipboards: Map<string, BlueprintClipboard> = new Map();
    static savedSlotsCache: Map<string, (CompactBlueprintSlot | null)[]> = new Map();

    static initialize(): void {
        world.beforeEvents.playerLeave.subscribe((event) => {
            const name = event.player.name;
            system.run(() => {
                this.copyPos1Map.delete(name);
            });
        });

        world.afterEvents.playerDimensionChange.subscribe((event) => {
            this.copyPos1Map.delete(event.player.name);
        });
    }

    static getOrCreateClipboard(playerName: string): BlueprintClipboard {
        if (!this.clipboards.has(playerName)) {
            this.clipboards.set(playerName, {
                name: "Nova Planta",
                blocks: [],
                width: 0,
                height: 0,
                length: 0,
                rotation: 0,
                mirrorX: false,
                captureArmed: true
            });
        }
        return this.clipboards.get(playerName)!;
    }

    static hasActiveBlueprint(playerName: string): boolean {
        const cb = this.clipboards.get(playerName);
        return Boolean(cb && cb.blocks.length > 0 && !cb.captureArmed);
    }

    static isCapturing(playerName: string): boolean {
        if (this.copyPos1Map.has(playerName)) return true;
        return !this.hasActiveBlueprint(playerName);
    }

    static armCapture(playerName: string): void {
        this.copyPos1Map.delete(playerName);
        const cb = this.getOrCreateClipboard(playerName);
        cb.captureArmed = true;
    }

    static cancelCapture(playerName: string): void {
        this.copyPos1Map.delete(playerName);
        const cb = this.getOrCreateClipboard(playerName);
        if (cb.blocks.length > 0) {
            cb.captureArmed = false;
        }
    }

    static setCopyPos1(player: Player, pos: Vector3): void {
        this.copyPos1Map.set(player.name, {
            pos: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
            dimensionId: player.dimension.id
        });
    }

    static getCopyPos1(playerName: string, dimensionId: string): Vector3 | null {
        const entry = this.copyPos1Map.get(playerName);
        if (!entry || entry.dimensionId !== dimensionId) return null;
        return entry.pos;
    }

    static clearCopyPos1(playerName: string): void {
        this.copyPos1Map.delete(playerName);
    }

    static rotateClipboard(playerName: string): 0 | 90 | 180 | 270 {
        const cb = this.getOrCreateClipboard(playerName);
        const nextMap: Record<number, 0 | 90 | 180 | 270> = { 0: 90, 90: 180, 180: 270, 270: 0 };
        cb.rotation = nextMap[cb.rotation] ?? 0;
        return cb.rotation;
    }

    static toggleMirrorClipboard(playerName: string): boolean {
        const cb = this.getOrCreateClipboard(playerName);
        cb.mirrorX = !cb.mirrorX;
        return cb.mirrorX;
    }

    static extractRelevantStates(perm: BlockPermutation): Record<string, string | number | boolean> {
        const result: Record<string, string | number | boolean> = {};
        try {
            const all = perm.getAllStates();
            for (const key of RELEVANT_STATE_KEYS) {
                if (key in all) {
                    const v = all[key];
                    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
                        result[key] = v;
                    }
                }
            }
        } catch { }
        return result;
    }

    static captureRegion(
        player: Player,
        posA: Vector3,
        posB: Vector3,
        isCreative: boolean,
        isUndestroyableFn: (typeId: string) => boolean
    ): { ok: boolean; count: number; message: string } {
        const minX = Math.floor(Math.min(posA.x, posB.x));
        const maxX = Math.floor(Math.max(posA.x, posB.x));
        const minY = Math.floor(Math.min(posA.y, posB.y));
        const maxY = Math.floor(Math.max(posA.y, posB.y));
        const minZ = Math.floor(Math.min(posA.z, posB.z));
        const maxZ = Math.floor(Math.max(posA.z, posB.z));

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const length = maxZ - minZ + 1;

        if (width > 32 || height > 32 || length > 32) {
            return {
                ok: false,
                count: 0,
                message: `Área muito grande (${width}x${height}x${length}). O limite máximo por eixo é 32 blocos.`
            };
        }

        const anchorX = Math.floor((minX + maxX) / 2);
        const anchorY = minY;
        const anchorZ = Math.floor((minZ + maxZ) / 2);

        const captured: BlueprintBlock[] = [];
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    try {
                        const block = player.dimension.getBlock({ x, y, z });
                        if (!block || block.typeId === "minecraft:air" || block.isLiquid) continue;
                        if (block.typeId.startsWith("arc_st:holo")) continue;
                        if (BlockUtils.hasContainerOrComplexData(block)) continue;
                        if (!isCreative && isUndestroyableFn(block.typeId)) continue;

                        captured.push({
                            dx: x - anchorX,
                            dy: y - anchorY,
                            dz: z - anchorZ,
                            typeId: block.typeId,
                            states: this.extractRelevantStates(block.permutation)
                        });
                        if (captured.length >= this.MAX_BLUEPRINT_BLOCKS) {
                            break;
                        }
                    } catch { }
                }
                if (captured.length >= this.MAX_BLUEPRINT_BLOCKS) break;
            }
            if (captured.length >= this.MAX_BLUEPRINT_BLOCKS) break;
        }

        this.copyPos1Map.delete(player.name);

        if (captured.length === 0) {
            return {
                ok: false,
                count: 0,
                message: "Nenhum bloco sólido copiável encontrado entre os 2 pontos!"
            };
        }

        this.clipboards.set(player.name, {
            name: `Planta ${width}x${height}x${length}`,
            blocks: captured,
            width,
            height,
            length,
            rotation: 0,
            mirrorX: false,
            captureArmed: false
        });

        const capNote = captured.length >= this.MAX_BLUEPRINT_BLOCKS ? " (limite de 500 atingido)" : "";
        return {
            ok: true,
            count: captured.length,
            message: `Planta copiada com ${captured.length} blocos (${width}x${height}x${length})${capNote}! Aponte e use o cetro para colar.`
        };
    }

    static getTransformedBlocks(
        playerName: string,
        anchor: Vector3
    ): Array<{ pos: Vector3; typeId: string; permutation: BlockPermutation }> {
        const cb = this.clipboards.get(playerName);
        if (!cb || cb.blocks.length === 0) return [];
        const ax = Math.floor(anchor.x);
        const ay = Math.floor(anchor.y);
        const az = Math.floor(anchor.z);

        const out: Array<{ pos: Vector3; typeId: string; permutation: BlockPermutation }> = [];
        for (const b of cb.blocks) {
            const mx = cb.mirrorX ? -b.dx : b.dx;
            const mz = b.dz;
            let rx = mx;
            let rz = mz;
            if (cb.rotation === 90) {
                rx = -mz;
                rz = mx;
            } else if (cb.rotation === 180) {
                rx = -mx;
                rz = -mz;
            } else if (cb.rotation === 270) {
                rx = mz;
                rz = -mx;
            }

            let perm = BlockPermutation.resolve(b.typeId);
            const rotatedStates = BlockUtils.rotateBlockStates(b.states, cb.rotation, cb.mirrorX);
            for (const [k, v] of Object.entries(rotatedStates)) {
                try {
                    perm = perm.withState(k as never, v as never);
                } catch { }
            }

            out.push({
                pos: { x: ax + rx, y: ay + b.dy, z: az + rz },
                typeId: b.typeId,
                permutation: perm
            });
        }
        return out;
    }

    static computePreviewPositions(
        player: Player,
        maxDist: number,
        canPlaceAt: (pos: Vector3) => boolean
    ): Vector3[] | null {
        const pos1 = this.getCopyPos1(player.name, player.dimension.id);
        if (pos1) {
            const hit = player.getBlockFromViewDirection({
                maxDistance: maxDist,
                includeLiquidBlocks: false,
                includePassableBlocks: false
            });
            const pos2 = hit?.block ? hit.block.location : VectorUtils.getRaycastCenter(player, Math.min(16, maxDist));
            return PatternEngine.calculateBox2P(pos1, pos2, "frame", 400);
        }

        if (!this.hasActiveBlueprint(player.name)) return null;
        const anchor = VectorUtils.getSurfacePlacementCenter(player, maxDist);
        const transformed = this.getTransformedBlocks(player.name, anchor);
        return transformed.map(t => t.pos).filter(p => canPlaceAt(p));
    }

    static getRequiredMaterials(playerName: string): Map<string, number> {
        const counts = new Map<string, number>();
        const cb = this.clipboards.get(playerName);
        if (!cb) return counts;
        for (const b of cb.blocks) {
            counts.set(b.typeId, (counts.get(b.typeId) ?? 0) + 1);
        }
        return counts;
    }

    private static loadRawSlots(player: Player): (CompactBlueprintSlot | null)[] {
        if (this.savedSlotsCache.has(player.name)) {
            return this.savedSlotsCache.get(player.name)!;
        }
        let slots: (CompactBlueprintSlot | null)[] = [null, null, null];
        try {
            const raw = player.getDynamicProperty(BLUEPRINTS_PROPERTY_KEY);
            if (typeof raw === "string" && raw.length > 0) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    slots = [parsed[0] ?? null, parsed[1] ?? null, parsed[2] ?? null];
                }
            }
        } catch { }
        this.savedSlotsCache.set(player.name, slots);
        return slots;
    }

    private static persistRawSlots(player: Player, slots: (CompactBlueprintSlot | null)[]): boolean {
        try {
            const serialized = JSON.stringify(slots);
            if (serialized.length > MAX_DYNAMIC_BYTES) {
                return false;
            }
            player.setDynamicProperty(BLUEPRINTS_PROPERTY_KEY, serialized);
            this.savedSlotsCache.set(player.name, slots);
            return true;
        } catch {
            return false;
        }
    }

    static getSavedSlotsInfo(player: Player): ({ name: string; blockCount: number; dims: string } | null)[] {
        const raw = this.loadRawSlots(player);
        return raw.map(slot => {
            if (!slot) return null;
            return {
                name: slot.n,
                blockCount: slot.b.length,
                dims: `${slot.w}x${slot.h}x${slot.l}`
            };
        });
    }

    static saveClipboardToSlot(player: Player, slotIdx: number, customName: string): { ok: boolean; message: string } {
        if (slotIdx < 0 || slotIdx > 2) return { ok: false, message: "Slot inválido." };
        const cb = this.clipboards.get(player.name);
        if (!cb || cb.blocks.length === 0) {
            return { ok: false, message: "Nenhuma planta copiada na área de transferência para salvar!" };
        }

        const dictTypes: string[] = [];
        const typeIndexMap = new Map<string, number>();
        const dictStates: Record<string, string | number | boolean>[] = [];
        const stateIndexMap = new Map<string, number>();
        const compactBlocks: [number, number, number, number, number][] = [];

        for (const blk of cb.blocks) {
            const shortType = blk.typeId.startsWith("minecraft:")
                ? blk.typeId.slice("minecraft:".length)
                : blk.typeId;
            let tIdx = typeIndexMap.get(shortType);
            if (tIdx === undefined) {
                tIdx = dictTypes.length;
                dictTypes.push(shortType);
                typeIndexMap.set(shortType, tIdx);
            }

            const stateKey = JSON.stringify(blk.states);
            let sIdx = stateIndexMap.get(stateKey);
            if (sIdx === undefined) {
                sIdx = dictStates.length;
                dictStates.push(blk.states);
                stateIndexMap.set(stateKey, sIdx);
            }

            compactBlocks.push([blk.dx, blk.dy, blk.dz, tIdx, sIdx]);
        }

        const slots = [...this.loadRawSlots(player)];
        const finalName = customName.trim() || cb.name || `Planta ${slotIdx + 1}`;
        slots[slotIdx] = {
            n: finalName,
            w: cb.width,
            h: cb.height,
            l: cb.length,
            d: dictTypes,
            s: dictStates,
            b: compactBlocks
        };

        if (!this.persistRawSlots(player, slots)) {
            return {
                ok: false,
                message: "Memória de plantas cheia! Tente salvar uma estrutura menor ou apague outro slot."
            };
        }
        cb.name = finalName;
        return { ok: true, message: `Planta '${finalName}' (${cb.blocks.length} blocos) salva no Slot ${slotIdx + 1}!` };
    }

    static loadSlotToClipboard(player: Player, slotIdx: number): { ok: boolean; message: string } {
        if (slotIdx < 0 || slotIdx > 2) return { ok: false, message: "Slot inválido." };
        const slot = this.loadRawSlots(player)[slotIdx];
        if (!slot || slot.b.length === 0) {
            return { ok: false, message: `O Slot ${slotIdx + 1} está vazio.` };
        }

        const blocks: BlueprintBlock[] = slot.b.map(([dx, dy, dz, tIdx, sIdx]) => {
            const rawType = slot.d[tIdx] ?? "stone";
            const fullType = rawType.includes(":") ? rawType : `minecraft:${rawType}`;
            const states = slot.s[sIdx] ? { ...slot.s[sIdx] } : {};
            return { dx, dy, dz, typeId: fullType, states };
        });

        this.copyPos1Map.delete(player.name);
        this.clipboards.set(player.name, {
            name: slot.n,
            blocks,
            width: slot.w,
            height: slot.h,
            length: slot.l,
            rotation: 0,
            mirrorX: false,
            captureArmed: false
        });
        return { ok: true, message: `Planta '${slot.n}' (${blocks.length} blocos) carregada! Aponte e use o cetro para colar.` };
    }

    static deleteSlot(player: Player, slotIdx: number): void {
        if (slotIdx < 0 || slotIdx > 2) return;
        const slots = [...this.loadRawSlots(player)];
        slots[slotIdx] = null;
        this.persistRawSlots(player, slots);
    }

    static loadPrefabToClipboard(player: Player, prefabId: string, primaryBlockType?: string): { ok: boolean; message: string } {
        const meta = this.PREFABS.find(p => p.id === prefabId);
        if (!meta) return { ok: false, message: "Estrutura pronta não encontrada." };

        const mainBlock = (primaryBlockType && !primaryBlockType.startsWith("arc_st:"))
            ? primaryBlockType
            : "minecraft:stone_bricks";
        const blocks: BlueprintBlock[] = [];
        const seen = new Set<string>();
        const addBlk = (dx: number, dy: number, dz: number, typeId = mainBlock, states: Record<string, string | number | boolean> = {}) => {
            const key = `${dx},${dy},${dz}`;
            if (seen.has(key)) return;
            seen.add(key);
            blocks.push({ dx, dy, dz, typeId, states });
        };

        let width = 7, height = 7, length = 7;

        if (prefabId === "watchtower") {
            width = 7; height = 10; length = 7;
            for (let y = 0; y <= 9; y++) {
                for (let x = -3; x <= 3; x++) {
                    for (let z = -3; z <= 3; z++) {
                        const distSq = x * x + z * z;
                        if (y === 0 || y === 8) {
                            if (distSq <= 9 && !(y === 8 && x === 1 && z === 0)) addBlk(x, y, z);
                        } else if (y < 8) {
                            const isWall = distSq >= 6 && distSq <= 10;
                            const isDoor = z === -3 && Math.abs(x) <= 0 && (y === 1 || y === 2);
                            const isWin = (y === 4 || y === 5) && ((Math.abs(x) === 3 && z === 0) || (x === 0 && z === 3));
                            if (isWall && !isDoor && !isWin) addBlk(x, y, z);
                        } else if (y === 9) {
                            const isRim = distSq >= 6 && distSq <= 10;
                            if (isRim && ((x + z) % 2 === 0)) addBlk(x, y, z);
                        }
                    }
                }
                if (y >= 1 && y <= 7) {
                    addBlk(0, y, 0);
                    const angle = y * (Math.PI / 4);
                    addBlk(Math.round(Math.cos(angle) * 1.5), y, Math.round(Math.sin(angle) * 1.5));
                }
            }
        } else if (prefabId === "arched_bridge") {
            width = 11; height = 5; length = 5;
            for (let x = -5; x <= 5; x++) {
                const norm = x / 5;
                const archY = Math.round(2.4 * (1 - norm * norm));
                for (let z = -1; z <= 1; z++) {
                    addBlk(x, archY, z);
                }
                addBlk(x, archY + 1, -2);
                addBlk(x, archY + 1, 2);
                if (Math.abs(x) === 5 || x === 0) {
                    for (let y = 0; y <= archY + 2; y++) {
                        addBlk(x, y, -2);
                        addBlk(x, y, 2);
                    }
                    addBlk(x, archY + 3, -2, "minecraft:torch");
                    addBlk(x, archY + 3, 2, "minecraft:torch");
                }
            }
        } else if (prefabId === "cozy_cabin") {
            width = 7; height = 7; length = 7;
            for (let x = -3; x <= 3; x++) {
                for (let z = -3; z <= 3; z++) {
                    addBlk(x, 0, z);
                }
            }
            for (let y = 1; y <= 3; y++) {
                for (let x = -3; x <= 3; x++) {
                    for (let z = -3; z <= 3; z++) {
                        const isEdge = Math.abs(x) === 3 || Math.abs(z) === 3;
                        if (!isEdge) continue;
                        const isDoor = z === -3 && x === 0 && (y === 1 || y === 2);
                        const isWin = y === 2 && ((Math.abs(x) === 3 && z === 0) || (z === 3 && x === 0));
                        if (!isDoor && !isWin) addBlk(x, y, z);
                    }
                }
            }
            for (let layer = 0; layer <= 3; layer++) {
                const halfW = 3 - layer;
                const y = 4 + layer;
                for (let z = -3; z <= 3; z++) {
                    addBlk(-halfW, y, z);
                    addBlk(halfW, y, z);
                    if (Math.abs(z) === 3) {
                        for (let x = -halfW; x <= halfW; x++) addBlk(x, y, z);
                    }
                }
            }
        } else if (prefabId === "plaza_fountain") {
            width = 7; height = 5; length = 7;
            for (let x = -3; x <= 3; x++) {
                for (let z = -3; z <= 3; z++) {
                    const d = x * x + z * z;
                    if (d <= 10) addBlk(x, 0, z);
                    if (d >= 6 && d <= 10) addBlk(x, 1, z);
                }
            }
            for (let y = 1; y <= 4; y++) addBlk(0, y, 0);
            addBlk(1, 3, 0); addBlk(-1, 3, 0); addBlk(0, 3, 1); addBlk(0, 3, -1);
        } else if (prefabId === "street_lamps") {
            width = 5; height = 6; length = 3;
            for (let x = -1; x <= 1; x++) {
                for (let z = -1; z <= 1; z++) {
                    if (Math.abs(x) + Math.abs(z) <= 1) addBlk(x, 0, z);
                }
            }
            for (let y = 1; y <= 5; y++) addBlk(0, y, 0);
            for (let x = -2; x <= 2; x++) addBlk(x, 5, 0);
            addBlk(-2, 4, 0, "minecraft:lantern", { hanging: true });
            addBlk(2, 4, 0, "minecraft:lantern", { hanging: true });
        } else if (prefabId === "nether_shrine") {
            width = 9; height = 8; length = 5;
            for (let x = -4; x <= 4; x++) {
                for (let z = -2; z <= 2; z++) {
                    addBlk(x, 0, z);
                }
            }
            for (let y = 1; y <= 5; y++) {
                for (let x = -1; x <= 2; x++) {
                    const isFrame = y === 1 || y === 5 || x === -1 || x === 2;
                    if (isFrame) addBlk(x, y, 0, "minecraft:obsidian");
                }
                addBlk(-3, y, -1); addBlk(-3, y, 1);
                addBlk(4, y, -1);  addBlk(4, y, 1);
            }
            for (let x = -3; x <= 4; x++) {
                addBlk(x, 6, -1); addBlk(x, 6, 0); addBlk(x, 6, 1);
                if (x >= -1 && x <= 2) addBlk(x, 7, 0);
            }
        }

        this.copyPos1Map.delete(player.name);
        this.clipboards.set(player.name, {
            name: meta.name,
            blocks,
            width,
            height,
            length,
            rotation: 0,
            mirrorX: false,
            captureArmed: false
        });
        return {
            ok: true,
            message: `Estrutura '${meta.name}' (${blocks.length} blocos) carregada! Aponte para o chão e use o cetro para colar.`
        };
    }
}
