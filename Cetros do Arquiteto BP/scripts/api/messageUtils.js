const PATTERN_LABELS = {
    connected: "Conectado",
    line: "Linha",
    floor: "Piso",
    stairs: "Escada",
    wall: "Parede",
    spiral: "Espiral",
    box2p: "Caixa 2P",
    gable_roof: "Telhado 2 Águas",
    overlay: "Paisagismo",
    arch: "Arco",
    circle: "Círculo",
    cylinder: "Cilindro",
    sphere: "Esfera",
    dome: "Domo",
    torus: "Toroide",
    cube: "Cubo",
    pyramid: "Pirâmide",
    area: "Área",
    tunnel: "Túnel",
    foliage: "Limpar Mato",
    blueprint: "Planta"
};
const MODE_LABELS = {
    construction: "CONSTRUÇÃO",
    destruction: "DEMOLIÇÃO",
    replace: "SUBSTITUIÇÃO",
    blueprint: "PLANTA"
};
export class MessageUtils {
    static getPatternLabel(pattern) {
        return PATTERN_LABELS[pattern] ?? pattern;
    }
    static getModeLabel(mode) {
        return MODE_LABELS[mode] ?? mode.toUpperCase();
    }
    static sendMessage(player, message) {
        player.sendMessage(this.PREFIX + message);
    }
    static sendSelectionMessage(player, blockName) {
        const message = `${this.COLORS.yellow}Bloco selecionado: ${this.COLORS.aqua}${this.FORMAT.bold}${blockName}${this.FORMAT.reset}${this.COLORS.yellow}.`;
        player.sendMessage(this.PREFIX + message);
    }
    static sendSuccessMessage(player, message) {
        player.sendMessage(this.PREFIX + this.COLORS.green + message);
    }
    static sendErrorMessage(player, message) {
        player.sendMessage(this.PREFIX + this.COLORS.red + message);
    }
    static sendClearMessage(player) {
        player.sendMessage(this.PREFIX + this.COLORS.gray + "Seleção de bloco limpa.");
    }
    static sendReplaceMessage(player, type, blockName) {
        const readableName = this.getReadableBlockName(blockName);
        if (type === "find") {
            const message = `${this.COLORS.yellow}Bloco alvo definido: ${this.COLORS.aqua}${this.FORMAT.bold}${readableName}${this.FORMAT.reset}`;
            player.sendMessage(this.PREFIX + message);
        }
        else {
            const message = `${this.COLORS.green}Substituir por: ${this.COLORS.aqua}${this.FORMAT.bold}${readableName}${this.FORMAT.reset}`;
            player.sendMessage(this.PREFIX + message);
        }
    }
    static getReadableBlockName(blockType) {
        return (blockType.split(":").pop() || blockType).replace(/_/g, " ");
    }
    static getModeDisplay(mode) {
        const modeColors = {
            construction: this.COLORS.green,
            destruction: this.COLORS.red,
            replace: this.COLORS.yellow,
            blueprint: this.COLORS.lightPurple
        };
        const color = modeColors[mode] || this.COLORS.white;
        return `${color}Modo: ${this.FORMAT.bold}${this.getModeLabel(mode)}`;
    }
}
MessageUtils.COLORS = {
    white: "§f", yellow: "§e", green: "§a", aqua: "§b", red: "§c",
    lightPurple: "§d", gold: "§6", gray: "§8", darkGreen: "§2",
    blue: "§9", black: "§0", darkRed: "§4", darkAqua: "§3",
    darkBlue: "§1", darkPurple: "§5", darkGray: "§8"
};
MessageUtils.FORMAT = {
    bold: "§l", italic: "§o", underline: "§n",
    strikethrough: "§m", reset: "§r"
};
MessageUtils.PREFIX = `§8[§b§lARQUITETO§r§8] `;
