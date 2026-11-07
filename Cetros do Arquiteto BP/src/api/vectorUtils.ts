import { Player, Vector3 } from "@minecraft/server";

export class VectorUtils {
    static normalize(vector: Vector3): Vector3 {
        const lengthSquared = vector.x ** 2 + vector.y ** 2 + vector.z ** 2;
        if (lengthSquared === 0) return { x: 0, y: 0, z: 0 };
        const length = Math.sqrt(lengthSquared);
        return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
    }

    static getFaceOffset(face: string): Vector3 {
        const cleanFace = face.toLowerCase().replace("face.", "");
        return this.FACE_OFFSETS[cleanFace] || { x: 0, y: 0, z: 0 };
    }

    static getPositionKey(pos: Vector3): string {
        return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
    }

    static add(a: Vector3, b: Vector3): Vector3 {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    }

    static subtract(a: Vector3, b: Vector3): Vector3 {
        return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    }

    static multiply(vector: Vector3, scalar: number): Vector3 {
        return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
    }

    static distance(a: Vector3, b: Vector3): number {
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        return Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
    }

    static distanceSquared(a: Vector3, b: Vector3): number {
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        return dx ** 2 + dy ** 2 + dz ** 2;
    }

    static floor(vector: Vector3): Vector3 {
        return { x: Math.floor(vector.x), y: Math.floor(vector.y), z: Math.floor(vector.z) };
    }

    static equals(a: Vector3, b: Vector3, tolerance = 0): boolean {
        return Math.abs(a.x - b.x) <= tolerance &&
            Math.abs(a.y - b.y) <= tolerance &&
            Math.abs(a.z - b.z) <= tolerance;
    }

    static getRaycastCenter(player: Player, maxDistance = 64): Vector3 {
        const blockFromView = player.getBlockFromViewDirection({
            maxDistance,
            includeLiquidBlocks: true,
            includePassableBlocks: false
        });
        if (blockFromView?.block && !blockFromView.block.typeId.startsWith("arc_st:holo")) {
            return blockFromView.block.location;
        }
        const viewDir = this.normalize(player.getViewDirection());
        const fallbackDistance = 5;
        return {
            x: Math.floor(player.location.x + viewDir.x * fallbackDistance),
            y: Math.floor(player.location.y + 1.6 + viewDir.y * fallbackDistance),
            z: Math.floor(player.location.z + viewDir.z * fallbackDistance)
        };
    }

    static getSurfacePlacementCenter(player: Player, maxDistance = 64): Vector3 {
        const blockFromView = player.getBlockFromViewDirection({
            maxDistance,
            includeLiquidBlocks: true,
            includePassableBlocks: false
        });
        if (blockFromView?.block && !blockFromView.block.typeId.startsWith("arc_st:holo")) {
            const offset = this.getFaceOffset(blockFromView.face);
            return {
                x: Math.floor(blockFromView.block.location.x + offset.x),
                y: Math.floor(blockFromView.block.location.y + offset.y),
                z: Math.floor(blockFromView.block.location.z + offset.z)
            };
        }
        return this.getRaycastCenter(player, maxDistance);
    }

    static FACE_OFFSETS: Record<string, Vector3> = {
        up: { x: 0, y: 1, z: 0 },
        down: { x: 0, y: -1, z: 0 },
        east: { x: 1, y: 0, z: 0 },
        west: { x: -1, y: 0, z: 0 },
        north: { x: 0, y: 0, z: -1 },
        south: { x: 0, y: 0, z: 1 }
    };
}
