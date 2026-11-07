import { BlockPermutation } from "@minecraft/server";

export interface BlockSelection {
    blockType: string;
    permutation: BlockPermutation;
}

export class BlockSelectionManager {
    static selections: Map<string, BlockSelection> = new Map();

    static getSelection(playerName: string): BlockSelection | undefined {
        return this.selections.get(playerName);
    }

    static setSelection(playerName: string, selection: BlockSelection): void {
        this.selections.set(playerName, selection);
    }

    static clearSelection(playerName: string): boolean {
        return this.selections.delete(playerName);
    }

    static hasSelection(playerName: string): boolean {
        return this.selections.has(playerName);
    }
}
