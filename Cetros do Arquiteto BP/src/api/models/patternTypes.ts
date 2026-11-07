export type DirectionLock = "free" | "horizontal" | "vertical";
export type LineSnap = "free" | "cardinal" | "diagonal";
export type PreviewStyle = "particles" | "blocks";
export type Box2PFillStyle = "filled" | "hollow" | "frame";
export type OverlayMode = "cover" | "fill_holes" | "smooth";
export type MirrorAxis = "x" | "y" | "z" | "xz";

export interface SupplyChestLocation {
    x: number;
    y: number;
    z: number;
    dimensionId: string;
}

export interface SpiralSettings {
    radius: number;
    height: number;
    stepWidth: number;
    centerPillar: boolean;
    clockwise: boolean;
}

export interface GableRoofSettings {
    width: number;
    length: number;
    type: "hollow" | "filled";
    closeGables: boolean;
}

export interface TorusSettings {
    majorRadius: number;
    tubeRadius: number;
    axis: "horizontal" | "vertical_x" | "vertical_z";
    hollow: boolean;
}

export interface ArchitectStats {
    blocksBuilt: number;
    blocksDestroyed: number;
    blocksReplaced: number;
    blueprintsPasted: number;
}

export interface Box2PSettings {
    fillStyle: Box2PFillStyle;
}

export interface OverlaySettings {
    radius: number;
    thickness: number;
    mode: OverlayMode;
}

export interface FoliageDestroySettings {
    radius: number;
    includeLeaves: boolean;
}

export interface SavedPalette {
    name: string;
    blocks: string[];
    weights: Record<string, number>;
}

export interface LineSettings {
    maxLength: number;
    snap: LineSnap;
}

export interface ConnectedSettings {
    maxBlocks: number;
    directionLock: DirectionLock;
}

export interface FloorSettings {
    width: number;
    length: number;
    filled: boolean;
}

export interface StairsSettings {
    width: number;
    steps: number;
    direction: "up" | "down";
}

export interface ArchSettings {
    span: number;
    height: number;
    depth: number;
}

export interface CircleSettings {
    radius: number;
    axis: string;
    filled: boolean;
}

export interface CylinderSettings {
    radius: number;
    height: number;
    type: "hollow" | "filled";
}

export interface SphereSettings {
    radius: number;
    type: string;
}

export interface DomeSettings {
    radius: number;
    type: "hollow" | "filled";
    inverted: boolean;
}

export interface WallSettings {
    width: number;
    height: number;
    thickness: number;
}

export interface CubeSettings {
    size: number;
    type: string;
}

export interface PyramidSettings {
    size: number;
    type: "hollow" | "filled";
    inverted: boolean;
}

export interface AreaDestroySettings {
    radius: number;
}

export interface TunnelDestroySettings {
    width: number;
    height: number;
    depth: number;
}

export interface ReplaceSettings {
    areaSize: number;
    findBlock: string | null;
    replaceBlock: string | null;
    keepSelections: boolean;
    usePalette: boolean;
    weatheringMode: boolean;
}

export interface RepeatSettings {
    enabled: boolean;
    count: number;
    spacing: number;
}

export interface MirrorSettings {
    enabled: boolean;
    axis: MirrorAxis;
    useWorldAnchor: boolean;
    worldAnchor: { x: number; y: number; z: number } | null;
}

export interface PatternConfig {
    mode: string;
    previewStyle: PreviewStyle;
    autoAdjacentSlot: boolean;
    matchSimilarBlocks: boolean;
    autoOrientBlocks: boolean;
    autoCraftBlocks: boolean;
    autoTorch: boolean;
    torchSpacing: number;
    supplyChest: SupplyChestLocation | null;
    activeConstructionPattern: string;
    activeDestructionPattern: string;
    activeReplaceMode: string;
    lineSettings: LineSettings;
    connectedSettings: ConnectedSettings;
    floorSettings: FloorSettings;
    stairsSettings: StairsSettings;
    archSettings: ArchSettings;
    circleSettings: CircleSettings;
    cylinderSettings: CylinderSettings;
    sphereSettings: SphereSettings;
    domeSettings: DomeSettings;
    wallSettings: WallSettings;
    cubeSettings: CubeSettings;
    pyramidSettings: PyramidSettings;
    spiralSettings: SpiralSettings;
    gableRoofSettings: GableRoofSettings;
    torusSettings: TorusSettings;
    box2pSettings: Box2PSettings;
    overlaySettings: OverlaySettings;
    areaDestroySettings: AreaDestroySettings;
    tunnelDestroySettings: TunnelDestroySettings;
    foliageDestroySettings: FoliageDestroySettings;
    replaceSettings: ReplaceSettings;
    repeatSettings: RepeatSettings;
    mirrorSettings: MirrorSettings;
    palette: string[];
    paletteWeights: Record<string, number>;
    savedPalettes: (SavedPalette | null)[];
    paletteWriteIndex: number;
    randomizerActive: boolean;
    randomizerPending: boolean;
    stats: ArchitectStats;
}

export const DEFAULT_PATTERN_CONFIG: PatternConfig = {
    mode: "construction",
    previewStyle: "particles",
    autoAdjacentSlot: false,
    matchSimilarBlocks: false,
    autoOrientBlocks: true,
    autoCraftBlocks: true,
    autoTorch: false,
    torchSpacing: 6,
    supplyChest: null,
    activeConstructionPattern: "connected",
    activeDestructionPattern: "connected",
    activeReplaceMode: "connected",
    lineSettings: {
        maxLength: 10,
        snap: "free"
    },
    connectedSettings: {
        maxBlocks: 20,
        directionLock: "free"
    },
    floorSettings: {
        width: 5,
        length: 5,
        filled: true
    },
    stairsSettings: {
        width: 3,
        steps: 6,
        direction: "up"
    },
    archSettings: {
        span: 7,
        height: 4,
        depth: 3
    },
    circleSettings: {
        radius: 5,
        axis: "horizontal",
        filled: false
    },
    cylinderSettings: {
        radius: 4,
        height: 5,
        type: "hollow"
    },
    sphereSettings: {
        radius: 5,
        type: "hollow"
    },
    domeSettings: {
        radius: 5,
        type: "hollow",
        inverted: false
    },
    wallSettings: {
        width: 5,
        height: 5,
        thickness: 1
    },
    cubeSettings: {
        size: 5,
        type: "hollow"
    },
    pyramidSettings: {
        size: 7,
        type: "hollow",
        inverted: false
    },
    spiralSettings: {
        radius: 4,
        height: 10,
        stepWidth: 2,
        centerPillar: true,
        clockwise: true
    },
    gableRoofSettings: {
        width: 7,
        length: 9,
        type: "hollow",
        closeGables: true
    },
    torusSettings: {
        majorRadius: 6,
        tubeRadius: 2,
        axis: "horizontal",
        hollow: true
    },
    box2pSettings: {
        fillStyle: "filled"
    },
    overlaySettings: {
        radius: 5,
        thickness: 1,
        mode: "cover"
    },
    areaDestroySettings: {
        radius: 5
    },
    tunnelDestroySettings: {
        width: 3,
        height: 3,
        depth: 5
    },
    foliageDestroySettings: {
        radius: 6,
        includeLeaves: false
    },
    replaceSettings: {
        areaSize: 5,
        findBlock: null,
        replaceBlock: null,
        keepSelections: false,
        usePalette: false,
        weatheringMode: false
    },
    repeatSettings: {
        enabled: false,
        count: 2,
        spacing: 3
    },
    mirrorSettings: {
        enabled: false,
        axis: "x",
        useWorldAnchor: false,
        worldAnchor: null
    },
    palette: [],
    paletteWeights: {},
    savedPalettes: [null, null, null],
    paletteWriteIndex: 0,
    randomizerActive: false,
    randomizerPending: false,
    stats: {
        blocksBuilt: 0,
        blocksDestroyed: 0,
        blocksReplaced: 0,
        blueprintsPasted: 0
    }
};
