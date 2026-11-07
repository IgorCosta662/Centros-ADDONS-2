import { VectorUtils } from "../api/vectorUtils";
import { BlockUtils } from "../api/blockUtils";
export class PatternEngine {
    static getSnappedLineDirection(player, snap) {
        const view = VectorUtils.normalize(player.getViewDirection());
        if (snap === "free")
            return view;
        if (snap === "cardinal")
            return this.getSnapDirection(player);
        // Diagonal 45° snap
        const absX = Math.abs(view.x);
        const absY = Math.abs(view.y);
        const absZ = Math.abs(view.z);
        if (absY > 0.75) {
            return { x: 0, y: Math.sign(view.y), z: 0 };
        }
        const sx = absX >= 0.25 ? Math.sign(view.x) : 0;
        const sz = absZ >= 0.25 ? Math.sign(view.z) : 0;
        const sy = absY >= 0.38 ? Math.sign(view.y) : 0;
        if (sx === 0 && sz === 0)
            return this.getSnapDirection(player);
        return { x: sx || Math.sign(view.x), y: sy, z: sz || Math.sign(view.z) };
    }
    static calculateStairs(center, player, width, steps, direction) {
        const positions = [];
        const facing = this.getPlayerFacing(player);
        const [widthAxis, , depthAxis] = this.getWallAxes(facing);
        const forwardSign = (facing === "east" || facing === "south") ? 1 : -1;
        const ySign = direction === "up" ? 1 : -1;
        const wStart = -Math.floor((width - 1) / 2);
        const wEnd = wStart + width - 1;
        const baseY = Math.floor(center.y);
        for (let s = 0; s < steps; s++) {
            for (let w = wStart; w <= wEnd; w++) {
                const pos = {
                    x: Math.floor(center.x),
                    y: baseY + s * ySign,
                    z: Math.floor(center.z)
                };
                pos[widthAxis] = Math.floor(center[widthAxis] + w);
                pos[depthAxis] = Math.floor(center[depthAxis] + s * forwardSign);
                positions.push(pos);
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateArch(center, player, span, height, depth) {
        const positions = [];
        const facing = this.getPlayerFacing(player);
        const [widthAxis, , depthAxis] = this.getWallAxes(facing);
        const forwardSign = (facing === "east" || facing === "south") ? 1 : -1;
        const halfSpan = Math.max(1, span / 2);
        const wStart = -Math.floor(halfSpan);
        const wEnd = Math.ceil(halfSpan);
        const baseY = Math.floor(center.y);
        for (let d = 0; d < depth; d++) {
            for (let w = wStart; w <= wEnd; w++) {
                const norm = w / halfSpan;
                if (Math.abs(norm) > 1)
                    continue;
                const arcY = Math.round(height * Math.sqrt(Math.max(0, 1 - norm * norm)));
                const prevNorm = (w - 1) / halfSpan;
                const nextNorm = (w + 1) / halfSpan;
                const prevY = Math.abs(prevNorm) <= 1 ? Math.round(height * Math.sqrt(Math.max(0, 1 - prevNorm * prevNorm))) : 0;
                const nextY = Math.abs(nextNorm) <= 1 ? Math.round(height * Math.sqrt(Math.max(0, 1 - nextNorm * nextNorm))) : 0;
                const minConnectY = Math.min(arcY, Math.max(prevY, nextY));
                for (let y = minConnectY; y <= arcY; y++) {
                    const pos = {
                        x: Math.floor(center.x),
                        y: baseY + y,
                        z: Math.floor(center.z)
                    };
                    pos[widthAxis] = Math.floor(center[widthAxis] + w);
                    pos[depthAxis] = Math.floor(center[depthAxis] + d * forwardSign);
                    positions.push(pos);
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateDome(center, radius, type, inverted = false) {
        const positions = [];
        const radiusSquared = radius * radius;
        const innerRadiusSquared = (radius - 1) * (radius - 1);
        const baseX = Math.floor(center.x);
        const baseY = Math.floor(center.y);
        const baseZ = Math.floor(center.z);
        for (let x = -radius; x <= radius; x++) {
            for (let y = 0; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    const distSquared = x * x + y * y + z * z;
                    const match = type === "filled"
                        ? distSquared <= radiusSquared
                        : (distSquared > innerRadiusSquared && distSquared <= radiusSquared);
                    if (match) {
                        const actualY = inverted ? baseY + (radius - y) : baseY + y;
                        positions.push({ x: baseX + x, y: actualY, z: baseZ + z });
                    }
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateTunnel(start, player, width, height, depth) {
        const positions = [];
        const facing = this.getPlayerFacing(player);
        const [widthAxis, , depthAxis] = this.getWallAxes(facing);
        const forwardSign = (facing === "east" || facing === "south") ? 1 : -1;
        const wStart = -Math.floor((width - 1) / 2);
        const wEnd = wStart + width - 1;
        const hStart = -Math.floor((height - 1) / 2);
        const hEnd = hStart + height - 1;
        for (let d = 0; d < depth; d++) {
            for (let w = wStart; w <= wEnd; w++) {
                for (let h = hStart; h <= hEnd; h++) {
                    const pos = {
                        x: Math.floor(start.x),
                        y: Math.floor(start.y + h),
                        z: Math.floor(start.z)
                    };
                    pos[widthAxis] = Math.floor(start[widthAxis] + w);
                    pos[depthAxis] = Math.floor(start[depthAxis] + d * forwardSign);
                    positions.push(pos);
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateCircle(center, radius, axis, filled = false) {
        const positions = [];
        const radiusSquared = radius * radius;
        const [axis1, axis2, fixedAxis] = this.getCircleAxes(axis);
        for (let a = -radius; a <= radius; a++) {
            for (let b = -radius; b <= radius; b++) {
                const distSquared = a * a + b * b;
                const match = filled
                    ? distSquared <= radiusSquared
                    : Math.abs(distSquared - radiusSquared) <= radius;
                if (match) {
                    const pos = { x: center.x, y: center.y, z: center.z };
                    pos[axis1] = Math.floor(center[axis1] + a);
                    pos[axis2] = Math.floor(center[axis2] + b);
                    pos[fixedAxis] = Math.floor(center[fixedAxis]);
                    positions.push(pos);
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateFloor(center, player, width, length, filled = true) {
        const positions = [];
        const facing = this.getPlayerFacing(player);
        const [widthAxis, , depthAxis] = this.getWallAxes(facing);
        const wStart = -Math.floor((width - 1) / 2);
        const wEnd = wStart + width - 1;
        const lStart = -Math.floor((length - 1) / 2);
        const lEnd = lStart + length - 1;
        const baseY = Math.floor(center.y);
        for (let w = wStart; w <= wEnd; w++) {
            for (let l = lStart; l <= lEnd; l++) {
                if (!filled && w !== wStart && w !== wEnd && l !== lStart && l !== lEnd) {
                    continue;
                }
                const pos = { x: center.x, y: baseY, z: center.z };
                pos[widthAxis] = Math.floor(center[widthAxis] + w);
                pos[depthAxis] = Math.floor(center[depthAxis] + l);
                positions.push(pos);
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateCylinder(center, radius, height, type) {
        const positions = [];
        const radiusSquared = radius * radius;
        const baseX = Math.floor(center.x);
        const baseY = Math.floor(center.y);
        const baseZ = Math.floor(center.z);
        for (let h = 0; h < height; h++) {
            for (let x = -radius; x <= radius; x++) {
                for (let z = -radius; z <= radius; z++) {
                    const distSquared = x * x + z * z;
                    const match = type === "filled"
                        ? distSquared <= radiusSquared
                        : Math.abs(distSquared - radiusSquared) <= radius;
                    if (match) {
                        positions.push({ x: baseX + x, y: baseY + h, z: baseZ + z });
                    }
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateSphere(center, radius, type) {
        const positions = [];
        const radiusSquared = radius * radius;
        const innerRadiusSquared = (radius - 1) * (radius - 1);
        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    const distSquared = x * x + y * y + z * z;
                    if (type === "filled") {
                        if (distSquared <= radiusSquared)
                            positions.push({ x: Math.floor(center.x + x), y: Math.floor(center.y + y), z: Math.floor(center.z + z) });
                    }
                    else {
                        if (distSquared > innerRadiusSquared && distSquared <= radiusSquared)
                            positions.push({ x: Math.floor(center.x + x), y: Math.floor(center.y + y), z: Math.floor(center.z + z) });
                    }
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateWall(center, player, width, height, thickness) {
        const positions = [];
        const facing = this.getPlayerFacing(player);
        const [widthAxis, heightAxis, depthAxis] = this.getWallAxes(facing);
        const wStart = -Math.floor((width - 1) / 2);
        const wEnd = wStart + width - 1;
        for (let w = wStart; w <= wEnd; w++) {
            for (let h = 0; h < height; h++) {
                for (let t = 0; t < thickness; t++) {
                    const pos = { x: center.x, y: center.y, z: center.z };
                    pos[widthAxis] = Math.floor(center[widthAxis] + w);
                    pos[heightAxis] = Math.floor(center[heightAxis] + h);
                    pos[depthAxis] = Math.floor(center[depthAxis] + t + 1);
                    positions.push(pos);
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateCube(center, size, type) {
        const positions = [];
        const start = -Math.floor((size - 1) / 2);
        const end = start + size - 1;
        for (let x = start; x <= end; x++) {
            for (let y = start; y <= end; y++) {
                for (let z = start; z <= end; z++) {
                    if (type === "filled") {
                        positions.push({ x: Math.floor(center.x + x), y: Math.floor(center.y + y), z: Math.floor(center.z + z) });
                    }
                    else {
                        if (x === start || x === end || y === start || y === end || z === start || z === end)
                            positions.push({ x: Math.floor(center.x + x), y: Math.floor(center.y + y), z: Math.floor(center.z + z) });
                    }
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculatePyramid(center, size, type, inverted = false) {
        const positions = [];
        const baseX = Math.floor(center.x);
        const baseY = Math.floor(center.y);
        const baseZ = Math.floor(center.z);
        const totalLayers = Math.ceil(size / 2);
        for (let layer = 0, layerSize = size; layerSize >= 1; layer++, layerSize -= 2) {
            const minOff = -Math.floor((layerSize - 1) / 2);
            const maxOff = minOff + layerSize - 1;
            const yOffset = inverted ? (totalLayers - 1 - layer) : layer;
            for (let x = minOff; x <= maxOff; x++) {
                for (let z = minOff; z <= maxOff; z++) {
                    if (type === "hollow") {
                        const isPerimeter = x === minOff || x === maxOff || z === minOff || z === maxOff;
                        if (!isPerimeter)
                            continue;
                    }
                    positions.push({ x: baseX + x, y: baseY + yOffset, z: baseZ + z });
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateSpiral(center, radius, height, stepWidth, centerPillar, clockwise) {
        const positions = [];
        const baseX = Math.floor(center.x);
        const baseY = Math.floor(center.y);
        const baseZ = Math.floor(center.z);
        const rClamp = Math.max(2, radius);
        const wClamp = Math.max(1, Math.min(4, stepWidth));
        for (let y = 0; y < height; y++) {
            if (centerPillar) {
                positions.push({ x: baseX, y: baseY + y, z: baseZ });
            }
            const baseAngle = (clockwise ? 1 : -1) * (y * (Math.PI / 6));
            for (let w = 0; w < wClamp; w++) {
                const angle = baseAngle - (clockwise ? 1 : -1) * (w * 0.18);
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                for (let r = 1; r <= rClamp; r += 0.5) {
                    const dx = Math.round(cosA * r);
                    const dz = Math.round(sinA * r);
                    if (dx === 0 && dz === 0 && !centerPillar)
                        continue;
                    positions.push({ x: baseX + dx, y: baseY + y, z: baseZ + dz });
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateGableRoof(center, player, width, length, type, closeGables) {
        const positions = [];
        const facing = this.getPlayerFacing(player);
        const [widthAxis, , depthAxis] = this.getWallAxes(facing);
        const baseY = Math.floor(center.y);
        const lMin = -Math.floor((length - 1) / 2);
        const lMax = lMin + length - 1;
        for (let layer = 0, curWidth = width; curWidth >= 1; layer++, curWidth -= 2) {
            const wMin = -Math.floor((curWidth - 1) / 2);
            const wMax = wMin + curWidth - 1;
            for (let l = lMin; l <= lMax; l++) {
                for (let w = wMin; w <= wMax; w++) {
                    if (type === "hollow") {
                        const isSlopeEdge = w === wMin || w === wMax;
                        const isGableEnd = closeGables && (l === lMin || l === lMax);
                        if (!isSlopeEdge && !isGableEnd)
                            continue;
                    }
                    const pos = {
                        x: Math.floor(center.x),
                        y: baseY + layer,
                        z: Math.floor(center.z)
                    };
                    pos[widthAxis] = Math.floor(center[widthAxis] + w);
                    pos[depthAxis] = Math.floor(center[depthAxis] + l);
                    positions.push(pos);
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateTorus(center, majorRadius, tubeRadius, axis, hollow = true) {
        const positions = [];
        const R = Math.max(2, majorRadius);
        const r = Math.max(1, Math.min(R - 1, tubeRadius));
        const rOuterSq = (r + 0.35) * (r + 0.35);
        const rInnerSq = Math.max(0, (r - 0.75) * (r - 0.75));
        const [axis1, axis2, fixedAxis] = this.getCircleAxes(axis);
        const span = R + r + 1;
        for (let a = -span; a <= span; a++) {
            for (let b = -span; b <= span; b++) {
                const radialDist = Math.sqrt(a * a + b * b) - R;
                const radialSq = radialDist * radialDist;
                if (radialSq > rOuterSq)
                    continue;
                for (let c = -r - 1; c <= r + 1; c++) {
                    const tubeDistSq = radialSq + c * c;
                    const match = hollow
                        ? (tubeDistSq <= rOuterSq && tubeDistSq >= rInnerSq)
                        : (tubeDistSq <= rOuterSq);
                    if (match) {
                        const pos = { x: center.x, y: center.y, z: center.z };
                        pos[axis1] = Math.floor(center[axis1] + a);
                        pos[axis2] = Math.floor(center[axis2] + b);
                        pos[fixedAxis] = Math.floor(center[fixedAxis] + c);
                        positions.push(pos);
                    }
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateAreaDestroy(center, radius) {
        const positions = [];
        const radiusSquared = radius * radius;
        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    if (x * x + y * y + z * z <= radiusSquared) {
                        positions.push({ x: Math.floor(center.x + x), y: Math.floor(center.y + y), z: Math.floor(center.z + z) });
                    }
                }
            }
        }
        return positions;
    }
    static calculateBox2P(pos1, pos2, fillStyle, maxVolume = 1000) {
        const minX = Math.floor(Math.min(pos1.x, pos2.x));
        const maxX = Math.min(minX + 31, Math.floor(Math.max(pos1.x, pos2.x)));
        const minY = Math.floor(Math.min(pos1.y, pos2.y));
        const maxY = Math.min(minY + 31, Math.floor(Math.max(pos1.y, pos2.y)));
        const minZ = Math.floor(Math.min(pos1.z, pos2.z));
        const maxZ = Math.min(minZ + 31, Math.floor(Math.max(pos1.z, pos2.z)));
        const positions = [];
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (fillStyle !== "filled") {
                        let boundaryCount = 0;
                        if (x === minX || x === maxX)
                            boundaryCount++;
                        if (y === minY || y === maxY)
                            boundaryCount++;
                        if (z === minZ || z === maxZ)
                            boundaryCount++;
                        if (fillStyle === "hollow" && boundaryCount < 1)
                            continue;
                        if (fillStyle === "frame" && boundaryCount < 2)
                            continue;
                    }
                    positions.push({ x, y, z });
                    if (positions.length >= maxVolume) {
                        return positions;
                    }
                }
            }
        }
        return positions;
    }
    static calculateTerrainOverlay(center, dimension, radius, thickness, mode) {
        const positions = [];
        const baseX = Math.floor(center.x);
        const baseY = Math.floor(center.y);
        const baseZ = Math.floor(center.z);
        const rSq = radius * radius;
        const clampedThickness = Math.max(1, Math.min(3, thickness));
        const findGroundY = (x, z) => {
            for (let y = baseY + radius + 2; y >= baseY - radius - 4; y--) {
                try {
                    const block = dimension.getBlock({ x, y, z });
                    if (!block || block.typeId === "minecraft:air" || block.typeId.startsWith("arc_st:holo"))
                        continue;
                    if (block.isLiquid || BlockUtils.isFoliageOrSnow(block.typeId, false))
                        continue;
                    return y;
                }
                catch {
                    return null;
                }
            }
            return null;
        };
        if (mode === "smooth") {
            const heightMap = new Map();
            const scanR = radius + 1;
            for (let dx = -scanR; dx <= scanR; dx++) {
                for (let dz = -scanR; dz <= scanR; dz++) {
                    const gy = findGroundY(baseX + dx, baseZ + dz);
                    if (gy !== null)
                        heightMap.set(`${dx},${dz}`, gy);
                }
            }
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (dx * dx + dz * dz > rSq)
                        continue;
                    const curY = heightMap.get(`${dx},${dz}`);
                    if (curY === undefined)
                        continue;
                    const neighbors = [
                        curY,
                        heightMap.get(`${dx - 1},${dz}`) ?? curY,
                        heightMap.get(`${dx + 1},${dz}`) ?? curY,
                        heightMap.get(`${dx},${dz - 1}`) ?? curY,
                        heightMap.get(`${dx},${dz + 1}`) ?? curY,
                        heightMap.get(`${dx - 1},${dz - 1}`) ?? curY,
                        heightMap.get(`${dx + 1},${dz + 1}`) ?? curY,
                        heightMap.get(`${dx - 1},${dz + 1}`) ?? curY,
                        heightMap.get(`${dx + 1},${dz - 1}`) ?? curY
                    ];
                    const avg = neighbors.reduce((s, v) => s + v, 0) / neighbors.length;
                    const targetY = Math.round(avg + 0.25);
                    if (targetY > curY) {
                        const maxFill = Math.min(targetY, curY + clampedThickness);
                        for (let y = curY + 1; y <= maxFill; y++) {
                            positions.push({ x: baseX + dx, y, z: baseZ + dz });
                        }
                    }
                }
            }
            return this.removeDuplicates(positions);
        }
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                if (dx * dx + dz * dz > rSq)
                    continue;
                const x = baseX + dx;
                const z = baseZ + dz;
                const groundY = findGroundY(x, z);
                if (groundY === null)
                    continue;
                if (mode === "cover") {
                    for (let t = 1; t <= clampedThickness; t++) {
                        positions.push({ x, y: groundY + t, z });
                    }
                }
                else {
                    if (groundY < baseY) {
                        const maxDepth = Math.max(clampedThickness * 3, 6);
                        const startY = Math.max(groundY + 1, baseY - maxDepth + 1);
                        for (let y = startY; y <= baseY; y++) {
                            positions.push({ x, y, z });
                        }
                    }
                }
            }
        }
        return this.removeDuplicates(positions);
    }
    static calculateFoliageClear(center, dimension, radius, includeLeaves) {
        const positions = [];
        const baseX = Math.floor(center.x);
        const baseY = Math.floor(center.y);
        const baseZ = Math.floor(center.z);
        const rSq = radius * radius;
        const vRange = Math.max(3, Math.ceil(radius * 0.8));
        for (let dy = -vRange; dy <= vRange; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (dx * dx + dz * dz > rSq)
                        continue;
                    const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
                    try {
                        const block = dimension.getBlock(pos);
                        if (block && BlockUtils.isFoliageOrSnow(block.typeId, includeLeaves)) {
                            positions.push(pos);
                        }
                    }
                    catch { }
                }
            }
        }
        return positions;
    }
    static applyMirror(positions, center, axis) {
        const cx = Math.floor(center.x);
        const cy = Math.floor(center.y);
        const cz = Math.floor(center.z);
        if (axis === "xz") {
            const mx = positions.map(pos => ({ x: 2 * cx - pos.x, y: pos.y, z: pos.z }));
            const combinedX = [...positions, ...mx];
            const mxz = combinedX.map(pos => ({ x: pos.x, y: pos.y, z: 2 * cz - pos.z }));
            return this.removeDuplicates([...combinedX, ...mxz]);
        }
        const mirrored = positions.map(pos => {
            switch (axis) {
                case "x": return { x: 2 * cx - pos.x, y: pos.y, z: pos.z };
                case "y": return { x: pos.x, y: 2 * cy - pos.y, z: pos.z };
                case "z": return { x: pos.x, y: pos.y, z: 2 * cz - pos.z };
            }
        });
        return this.removeDuplicates([...positions, ...mirrored]);
    }
    static applyRepeat(positions, count, spacing, direction) {
        const result = [...positions];
        for (let r = 1; r < count; r++) {
            const offset = { x: direction.x * r * spacing, y: direction.y * r * spacing, z: direction.z * r * spacing };
            positions.forEach(pos => result.push({ x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z }));
        }
        return this.removeDuplicates(result);
    }
    static getSnapDirection(player) {
        const view = player.getViewDirection();
        const absX = Math.abs(view.x), absY = Math.abs(view.y), absZ = Math.abs(view.z);
        if (absY > absX && absY > absZ)
            return { x: 0, y: Math.sign(view.y), z: 0 };
        if (absX > absZ)
            return { x: Math.sign(view.x), y: 0, z: 0 };
        return { x: 0, y: 0, z: Math.sign(view.z) };
    }
    static getCircleAxes(axis) {
        switch (axis) {
            case "horizontal": return ["x", "z", "y"];
            case "vertical_x": return ["x", "y", "z"];
            case "vertical_z": return ["z", "y", "x"];
            default: return ["x", "z", "y"];
        }
    }
    static getPlayerFacing(player) {
        const v = player.getViewDirection();
        return Math.abs(v.x) > Math.abs(v.z) ? (v.x > 0 ? "east" : "west") : (v.z > 0 ? "south" : "north");
    }
    static getWallAxes(facing) {
        switch (facing) {
            case "north":
            case "south": return ["x", "y", "z"];
            case "east":
            case "west": return ["z", "y", "x"];
            default: return ["x", "y", "z"];
        }
    }
    static removeDuplicates(positions) {
        const seen = new Set();
        const unique = [];
        for (const pos of positions) {
            const key = VectorUtils.getPositionKey(pos);
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(pos);
            }
        }
        return unique;
    }
    static optimizeForPreview(positions, maxPoints) {
        if (positions.length <= maxPoints)
            return positions;
        const bounds = this.getBounds(positions);
        const outline = [];
        for (const pos of positions) {
            const isEdge = pos.x === bounds.minX || pos.x === bounds.maxX ||
                pos.y === bounds.minY || pos.y === bounds.maxY ||
                pos.z === bounds.minZ || pos.z === bounds.maxZ;
            if (isEdge)
                outline.push(pos);
        }
        if (outline.length > maxPoints) {
            const step = Math.ceil(outline.length / maxPoints);
            return outline.filter((_, i) => i % step === 0);
        }
        return outline;
    }
    static getBounds(positions) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const pos of positions) {
            if (pos.x < minX)
                minX = pos.x;
            if (pos.x > maxX)
                maxX = pos.x;
            if (pos.y < minY)
                minY = pos.y;
            if (pos.y > maxY)
                maxY = pos.y;
            if (pos.z < minZ)
                minZ = pos.z;
            if (pos.z > maxZ)
                maxZ = pos.z;
        }
        return { minX, maxX, minY, maxY, minZ, maxZ };
    }
}
