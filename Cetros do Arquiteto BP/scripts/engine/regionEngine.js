import { world, system } from "@minecraft/server";
export class RegionEngine {
    static initialize() {
        world.beforeEvents.playerLeave.subscribe((event) => {
            const name = event.player.name;
            system.run(() => {
                this.pos1Map.delete(name);
            });
        });
        world.afterEvents.playerDimensionChange.subscribe((event) => {
            this.pos1Map.delete(event.player.name);
        });
    }
    static setPos1(player, pos, mode) {
        this.pos1Map.set(player.name, {
            pos: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
            dimensionId: player.dimension.id,
            mode
        });
    }
    static getPos1(playerName, dimensionId, mode) {
        const data = this.pos1Map.get(playerName);
        if (!data)
            return null;
        if (data.dimensionId !== dimensionId || data.mode !== mode) {
            return null;
        }
        return data.pos;
    }
    static clearPos1(playerName) {
        this.pos1Map.delete(playerName);
    }
    static hasPos1(playerName, dimensionId, mode) {
        return this.getPos1(playerName, dimensionId, mode) !== null;
    }
}
RegionEngine.pos1Map = new Map();
