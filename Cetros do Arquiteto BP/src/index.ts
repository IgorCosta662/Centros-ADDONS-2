import { world, system, ItemStack, Player } from "@minecraft/server";
import { BlockUtils } from "./api/blockUtils";
import { InventoryUtils } from "./api/inventoryUtils";
import { PlayerUtils } from "./api/playerUtils";
import { VectorUtils } from "./api/vectorUtils";
import { MessageUtils } from "./api/messageUtils";
import { StaffConfig } from "./config/staffConfig";
import { BlockSelectionManager } from "./api/models/blockSelection";
import { PlayerPatternSettings } from "./api/models/playerPatternSettings";
import { StaffEngine } from "./engine/staffEngine";
import { HoloPreviewEngine } from "./engine/holoEngine";
import { PatternEngine } from "./engine/patternEngine";
import { ReplaceEngine } from "./engine/replaceEngine";
import { StaffSpecialEngine } from "./engine/staffSpecialEngine";
import { StaffUI } from "./ui/staffUi";
import { GuideEngine } from "./engine/guideEngine";
import { UndoEngine } from "./engine/undoEngine";
import { RegionEngine } from "./engine/regionEngine";
import { BlueprintEngine } from "./engine/blueprintEngine";

export {
    BlockUtils,
    InventoryUtils,
    PlayerUtils,
    VectorUtils,
    MessageUtils,
    StaffConfig,
    BlockSelectionManager,
    PlayerPatternSettings,
    StaffEngine,
    HoloPreviewEngine,
    PatternEngine,
    ReplaceEngine,
    StaffSpecialEngine,
    GuideEngine,
    StaffUI,
    UndoEngine,
    RegionEngine,
    BlueprintEngine
};

const TOME_GIVEN_KEY = "arc_st:tome_received";
const ARCHITECT_TOME_ID = "arc_st:architect_tome";

const setupNewPlayer = (player: Player): void => {
    try {
        PlayerPatternSettings.loadFromPlayer(player);
        const hasReceivedTome = player.getDynamicProperty(TOME_GIVEN_KEY);
        if (hasReceivedTome) return;
        const architectTome = new ItemStack(ARCHITECT_TOME_ID, 1);
        const inventory = player.getComponent("inventory");
        if (!inventory?.container) {
            player.dimension.spawnItem(architectTome, player.location);
        } else {
            const remainingItem = inventory.container.addItem(architectTome);
            if (remainingItem) {
                player.dimension.spawnItem(remainingItem, player.location);
            }
        }
        player.setDynamicProperty(TOME_GIVEN_KEY, true);
        MessageUtils.sendMessage(player, "§aBem-vindo! Você recebeu o §bTomo do Arquiteto§a.");
    } catch (error) {
        console.warn(`Failed to give architect tome to ${player.name}: ${error}`);
    }
};

world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) {
        setupNewPlayer(event.player);
    }
});

system.run(() => {
    for (const player of world.getAllPlayers()) {
        PlayerPatternSettings.loadFromPlayer(player);
    }
});

StaffEngine.initialize();
UndoEngine.initialize();
PlayerUtils.initialize();
