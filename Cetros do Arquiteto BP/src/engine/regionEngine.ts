import { world, system, Player, Vector3 } from "@minecraft/server";

export interface Pos1Anchor {
    pos: Vector3;
    dimensionId: string;
    mode: string;
}

export class RegionEngine {
    static pos1Map: Map<string, Pos1Anchor> = new Map();

    static initialize(): void {
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

    static setPos1(player: Player, pos: Vector3, mode: string): void {
        this.pos1Map.set(player.name, {
            pos: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
            dimensionId: player.dimension.id,
            mode
        });
    }

    static getPos1(playerName: string, dimensionId: string, mode: string): Vector3 | null {
        const data = this.pos1Map.get(playerName);
        if (!data) return null;
        if (data.dimensionId !== dimensionId || data.mode !== mode) {
            return null;
        }
        return data.pos;
    }

    static clearPos1(playerName: string): void {
        this.pos1Map.delete(playerName);
    }

    static hasPos1(playerName: string, dimensionId: string, mode: string): boolean {
        return this.getPos1(playerName, dimensionId, mode) !== null;
    }
}
