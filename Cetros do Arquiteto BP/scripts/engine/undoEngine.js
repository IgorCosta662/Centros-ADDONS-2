import { world, system, GameMode } from "@minecraft/server";
import { MessageUtils } from "../api/messageUtils";
import { InventoryUtils } from "../api/inventoryUtils";
import { BlockUtils } from "../api/blockUtils";
import { PlayerUtils } from "../api/playerUtils";
const MAX_STACK = 5;
const MAX_BLOCKS = 2000;
const BATCH_SIZE = 60;
export class UndoEngine {
    static initialize() {
        system.runInterval(() => {
            for (const player of world.getAllPlayers()) {
                const pending = this.restoreQueues.get(player.name);
                if (!pending)
                    continue;
                if (pending.entries.length === 0) {
                    this.restoreQueues.delete(player.name);
                    if (pending.inverseEntries.length > 0) {
                        this.pushStack(pending.kind === "undo" ? this.redoStacks : this.stacks, player.name, pending.inverseEntries);
                    }
                    PlayerUtils.updatePlayerHotbarMessage(player);
                    const verb = pending.kind === "undo" ? "Desfeitos" : "Refeitos";
                    const doneMsg = pending.kind === "undo" ? "Ação desfeita" : "Ação refeita";
                    if (pending.missingItemsCount > 0) {
                        MessageUtils.sendMessage(player, `§a${verb} ${pending.restoredCount} blocos §7(${pending.missingItemsCount} ignorados: faltam itens no inventário).`);
                    }
                    else {
                        MessageUtils.sendSuccessMessage(player, `${doneMsg} (${pending.restoredCount} blocos).`);
                    }
                    continue;
                }
                const batch = pending.entries.splice(0, BATCH_SIZE);
                const result = this.processBatch(player, batch);
                pending.restoredCount += result.restored;
                pending.missingItemsCount += result.missingItems;
                pending.inverseEntries.push(...result.inverseEntries);
            }
        }, 2);
        world.beforeEvents.playerLeave.subscribe((event) => {
            const playerName = event.player.name;
            system.run(() => {
                this.restoreQueues.delete(playerName);
                this.stacks.delete(playerName);
                this.redoStacks.delete(playerName);
            });
        });
    }
    static pushStack(map, playerName, entries) {
        if (entries.length === 0)
            return;
        const stack = map.get(playerName) ?? [];
        if (stack.length >= MAX_STACK)
            stack.shift();
        stack.push(entries);
        map.set(playerName, stack);
    }
    static processBatch(player, entries) {
        const isCreative = player.getGameMode() === GameMode.creative;
        let restored = 0;
        let missingItems = 0;
        const refundTotals = new Map();
        const inverseEntries = [];
        for (const entry of entries) {
            try {
                const block = world.getDimension(entry.dimensionId).getBlock(entry.position);
                if (!block)
                    continue;
                let consumedItem;
                if (!isCreative) {
                    const expectedId = entry.newPermutation.type.id;
                    const isExpectedAirOrLiquid = expectedId === "minecraft:air" ||
                        expectedId === "minecraft:water" ||
                        expectedId === "minecraft:flowing_water" ||
                        expectedId === "minecraft:lava" ||
                        expectedId === "minecraft:flowing_lava";
                    if (isExpectedAirOrLiquid) {
                        const isCurrentlyAirOrLiquid = block.typeId === "minecraft:air" || block.isLiquid ||
                            block.typeId === expectedId;
                        if (!isCurrentlyAirOrLiquid)
                            continue;
                    }
                    else if (block.typeId !== expectedId) {
                        continue;
                    }
                    if (BlockUtils.hasContainerOrComplexData(block))
                        continue;
                    if (entry.requireItem) {
                        const fallbackType = entry.oldPermutation.type.id;
                        let itemToConsume = null;
                        if (InventoryUtils.countItemsInInventory(player, entry.requireItem) > 0) {
                            itemToConsume = entry.requireItem;
                        }
                        else if (fallbackType !== "minecraft:air" && fallbackType !== entry.requireItem && InventoryUtils.countItemsInInventory(player, fallbackType) > 0) {
                            itemToConsume = fallbackType;
                        }
                        if (!itemToConsume) {
                            missingItems++;
                            continue;
                        }
                        InventoryUtils.removeItemsFromInventory(player, itemToConsume, 1);
                        consumedItem = itemToConsume;
                    }
                }
                block.setPermutation(entry.oldPermutation);
                restored++;
                if (!isCreative && entry.refundItem) {
                    refundTotals.set(entry.refundItem, (refundTotals.get(entry.refundItem) ?? 0) + 1);
                }
                inverseEntries.push({
                    position: { x: entry.position.x, y: entry.position.y, z: entry.position.z },
                    oldPermutation: entry.newPermutation,
                    newPermutation: entry.oldPermutation,
                    dimensionId: entry.dimensionId,
                    requireItem: entry.refundItem,
                    refundItem: !isCreative ? consumedItem : undefined
                });
            }
            catch { }
        }
        if (!isCreative) {
            for (const [itemType, count] of refundTotals.entries()) {
                InventoryUtils.giveItemsOrDrop(player, itemType, count);
            }
        }
        return { restored, missingItems, inverseEntries };
    }
    static recordOperation(player, entries) {
        if (entries.length === 0 || entries.length > MAX_BLOCKS)
            return;
        this.pushStack(this.stacks, player.name, entries);
        this.redoStacks.delete(player.name);
    }
    static undo(player) {
        if (this.restoreQueues.has(player.name)) {
            MessageUtils.sendErrorMessage(player, "Já existe uma operação de desfazer/refazer em andamento.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        if (!this.canUndo(player.name)) {
            MessageUtils.sendErrorMessage(player, "Nada para desfazer.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        const stack = this.stacks.get(player.name);
        const operation = stack.pop();
        player.playSound("random.pop", { pitch: 0.7, volume: 0.8 });
        const ordered = [...operation].reverse();
        if (ordered.length <= BATCH_SIZE) {
            const { restored, missingItems, inverseEntries } = this.processBatch(player, ordered);
            if (inverseEntries.length > 0) {
                this.pushStack(this.redoStacks, player.name, inverseEntries);
            }
            PlayerUtils.updatePlayerHotbarMessage(player);
            if (missingItems > 0) {
                MessageUtils.sendMessage(player, `§aDesfeitos ${restored} blocos §7(${missingItems} ignorados: faltam itens no inventário).`);
            }
            else {
                MessageUtils.sendSuccessMessage(player, `Desfeitos ${restored} blocos.`);
            }
        }
        else {
            this.restoreQueues.set(player.name, {
                kind: "undo",
                entries: ordered,
                inverseEntries: [],
                restoredCount: 0,
                missingItemsCount: 0
            });
            MessageUtils.sendMessage(player, `Desfazendo ${ordered.length} blocos...`);
        }
    }
    static redo(player) {
        if (this.restoreQueues.has(player.name)) {
            MessageUtils.sendErrorMessage(player, "Já existe uma operação de desfazer/refazer em andamento.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        if (!this.canRedo(player.name)) {
            MessageUtils.sendErrorMessage(player, "Nada para refazer.");
            player.playSound("note.bass", { pitch: 0.8, volume: 1.0 });
            return;
        }
        const redoStack = this.redoStacks.get(player.name);
        const operation = redoStack.pop();
        player.playSound("random.pop", { pitch: 1.2, volume: 0.8 });
        const ordered = [...operation].reverse();
        if (ordered.length <= BATCH_SIZE) {
            const { restored, missingItems, inverseEntries } = this.processBatch(player, ordered);
            if (inverseEntries.length > 0) {
                this.pushStack(this.stacks, player.name, inverseEntries);
            }
            PlayerUtils.updatePlayerHotbarMessage(player);
            if (missingItems > 0) {
                MessageUtils.sendMessage(player, `§aRefeitos ${restored} blocos §7(${missingItems} ignorados: faltam itens no inventário).`);
            }
            else {
                MessageUtils.sendSuccessMessage(player, `Refeitos ${restored} blocos.`);
            }
        }
        else {
            this.restoreQueues.set(player.name, {
                kind: "redo",
                entries: ordered,
                inverseEntries: [],
                restoredCount: 0,
                missingItemsCount: 0
            });
            MessageUtils.sendMessage(player, `Refazendo ${ordered.length} blocos...`);
        }
    }
    static canUndo(playerName) {
        return (this.stacks.get(playerName)?.length ?? 0) > 0;
    }
    static canRedo(playerName) {
        return (this.redoStacks.get(playerName)?.length ?? 0) > 0;
    }
    static getCount(playerName) {
        return this.stacks.get(playerName)?.length ?? 0;
    }
    static getRedoCount(playerName) {
        return this.redoStacks.get(playerName)?.length ?? 0;
    }
    static createEntry(player, position, oldPermutation, newPermutation, refundItem, requireItem) {
        return {
            position: { x: position.x, y: position.y, z: position.z },
            oldPermutation,
            newPermutation,
            dimensionId: player.dimension.id,
            refundItem,
            requireItem
        };
    }
}
UndoEngine.stacks = new Map();
UndoEngine.redoStacks = new Map();
UndoEngine.restoreQueues = new Map();
