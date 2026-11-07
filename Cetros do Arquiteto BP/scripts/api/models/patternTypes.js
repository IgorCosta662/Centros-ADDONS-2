export const DEFAULT_PATTERN_CONFIG = {
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
