export class BlockSelectionManager {
    static getSelection(playerName) {
        return this.selections.get(playerName);
    }
    static setSelection(playerName, selection) {
        this.selections.set(playerName, selection);
    }
    static clearSelection(playerName) {
        return this.selections.delete(playerName);
    }
    static hasSelection(playerName) {
        return this.selections.has(playerName);
    }
}
BlockSelectionManager.selections = new Map();
