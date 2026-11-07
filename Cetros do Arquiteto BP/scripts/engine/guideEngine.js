import { ActionFormData } from "@minecraft/server-ui";
import { StaffConfig } from "../config/staffConfig";
const UI_BASE = "textures/igorcosta/architect_staffs/ui";
const ICON_BASICS = `${UI_BASE}/act_auto_slot`;
const ICON_CONSTRUCTION = `${UI_BASE}/mode_build`;
const ICON_DESTRUCTION = `${UI_BASE}/mode_break`;
const ICON_REPLACE = `${UI_BASE}/mode_swap`;
const ICON_BLUEPRINT = `${UI_BASE}/act_blueprint`;
const ICON_CHEST = `${UI_BASE}/act_chest`;
const ICON_STAFF_TIER = `${UI_BASE}/act_tier`;
const ICON_SPECIAL = "textures/igorcosta/architect_staffs/items/echo_staff";
const ICON_ADVANCED = `${UI_BASE}/act_freeze`;
const ICON_BACK = `${UI_BASE}/act_back`;
const ICON_CLOSE = `${UI_BASE}/act_clear`;
export class GuideEngine {
    static async openTutorial(player) {
        const form = new ActionFormData()
            .title("§l§bTOMO DO ARQUITETO")
            .body("§7Cetros do Arquiteto v4.0 §8• Criado por §eIgorCosta\n§8Selecione um capítulo do guia:")
            .button("§2Controles e Atalhos Rápidos", ICON_BASICS)
            .button("§aOs 17 Formatos Arquitetônicos", ICON_CONSTRUCTION)
            .button("§dPlantas & 6 Prefabs Prontos", ICON_BLUEPRINT)
            .button("§6Baú, Bancada Auto-Craft & Automação", ICON_CHEST)
            .button("§cDemolição, Túneis e Paisagismo", ICON_DESTRUCTION)
            .button("§eSubstituição, Pincel (%) & Ruínas", ICON_REPLACE)
            .button("§bOs 11 Cetros e Poderes Especiais", ICON_SPECIAL)
            .button("§9Simetria 4x, Calculadora & Maestria", ICON_ADVANCED)
            .button("§8Fechar Tomo", ICON_CLOSE);
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined)
            return;
        switch (response.selection) {
            case 0:
                await this.showBasics(player);
                break;
            case 1:
                await this.showConstruction(player);
                break;
            case 2:
                await this.showBlueprints(player);
                break;
            case 3:
                await this.showSupplyAndAutomation(player);
                break;
            case 4:
                await this.showDestruction(player);
                break;
            case 5:
                await this.showReplace(player);
                break;
            case 6:
                await this.showTiersAndPowers(player);
                break;
            case 7:
                await this.showAdvanced(player);
                break;
            case 8: return;
        }
    }
    static async showBasics(player) {
        const form = new ActionFormData()
            .title("§l§2CONTROLES E ATALHOS")
            .body("§eDomine o seu Cetro do Arquiteto:\n\n" +
            "§b1. §fAgachar + Usar §8abre o Painel Principal\n\n" +
            "§b2. §fOlhe para um bloco + Usar §8para selecioná-lo\n\n" +
            "§b3. §fUse novamente §8para executar no holograma\n\n" +
            "§b4. §fAgachar + Bater num bloco §8captura o bloco na hora!\n\n" +
            "§b5. §fAgachar + Bater num Baú/Barril §8vincula ou desvincula seu §6Baú de Suprimentos§8!\n\n" +
            "§6Indicadores na Barra de Ação:\n" +
            "§6[BAÚ] §8= Baú vinculado ativo | §e[LUZ] §8= Auto-Tochas\n" +
            "§b[TRAVADO] §8= Holograma congelado no local")
            .button("§8Voltar ao Índice", ICON_BACK)
            .button("§8Fechar", ICON_CLOSE);
        const response = await form.show(player);
        if (response.selection === 0)
            await this.openTutorial(player);
    }
    static async showConstruction(player) {
        const form = new ActionFormData()
            .title("§l§217 FORMATOS ARQUITETÔNICOS")
            .body("§aProjetos geométricos disponíveis:\n\n" +
            "§bCONECTADO §8(Todos) - Superfícies com trava [H]/[V]\n" +
            "§6LINHA §8(Todos) - Livre, Eixos [90°] ou Diagonal [45°]\n" +
            "§2PISO §8e §eESCADA §8(Todos) - Pisos e rampas alinhadas\n" +
            "§2PAISAGISMO §8(Todos) - Cobre colinas, tapa buracos ou §aSuaviza Ladeiras (Smooth)§8!\n" +
            "§aPAREDE §8e §bESPIRAL §8(Cobre+) - Muralhas e escadas em caracol com coluna central!\n" +
            "§3CAIXA 2P§8, §6ARCO§8, §eTELHADO 2 ÁGUAS §8(Ferro+) - Galpões e pontes\n" +
            "§dCÍRCULO §8e §5CILINDRO §8(Ferro+) - Anéis e torres\n" +
            "§3ESFERA§8, §bDOMO§8 e §dTOROIDE 3D §8(Ametista/Oceânico/Diamante+)\n" +
            "§eCUBO §8(Redstone/Diamante+) e §6PIRÂMIDE §8(Oceânico/Diamante+)")
            .button("§8Voltar ao Índice", ICON_BACK)
            .button("§8Fechar", ICON_CLOSE);
        const response = await form.show(player);
        if (response.selection === 0)
            await this.openTutorial(player);
    }
    static async showBlueprints(player) {
        const form = new ActionFormData()
            .title("§l§dPLANTAS & 6 PREFABS")
            .body("§dCopie estruturas ou use o Catálogo de Prefabs:\n\n" +
            "§61. Catálogo de 6 Prefabs Integrados: §fGere instantaneamente §eTorre de Vigia§f, §ePonte Arqueada§f, §eChalé Compacto§f, §eFonte Imperial§f, §ePostes Duplos §fe §eSantuário do Nether §fusando o seu bloco selecionado!\n\n" +
            "§b2. Copiar Estrutura: §fClique no §ePonto A §fe no §ePonto B §foposto (até 500 blocos).\n\n" +
            "§b3. Girar & Salvar: §fGire em §e90°/180°/270°§f, espelhe e salve em até §e3 Slots Permanentes§f!")
            .button("§8Voltar ao Índice", ICON_BACK)
            .button("§8Fechar", ICON_CLOSE);
        const response = await form.show(player);
        if (response.selection === 0)
            await this.openTutorial(player);
    }
    static async showSupplyAndAutomation(player) {
        const form = new ActionFormData()
            .title("§l§6BAÚ, BANCADA E AUTOMAÇÃO")
            .body("§6Baú de Suprimentos (Alcance 100m):\n" +
            "§8- Use §fAgachar + Bater §8num Baú ou Barril para puxar blocos ao construir e guardar blocos escavados!\n\n" +
            "§eBancada Automática (Auto-Craft na Mochila/Baú):\n" +
            "§8- Se acabarem suas Tábuas, Tijolos de Pedra, Lajes, Escadas ou Muros durante a obra, o cetro §acrafta automaticamente §8a partir de Troncos, Pedregulhos ou Pedras brutas e devolve o troco!\n\n" +
            "§bAuto-Orientação & Auto-Tochas:\n" +
            "§8- Alinha escadas em rampas, telhados de 2 águas, pirâmides e espirais, e ilumina pisos e túneis!")
            .button("§8Voltar ao Índice", ICON_BACK)
            .button("§8Fechar", ICON_CLOSE);
        const response = await form.show(player);
        if (response.selection === 0)
            await this.openTutorial(player);
    }
    static async showDestruction(player) {
        const form = new ActionFormData()
            .title("§l§4DEMOLIÇÃO E PAISAGISMO")
            .body("§c5 Modos de escavação + Suavizador de Terreno:\n\n" +
            "§bCONECTADO §8- Demole superfícies com trava [H]/[V]\n" +
            "§cDEMOLIR ÁREA §8- Limpa blocos em raio esférico\n" +
            "§6ESCAVAR TÚNEL §8- Abre galerias retangulares na mira\n" +
            "§3CAIXA 2 PONTOS §8- Demole entre Pos 1 e Pos 2\n" +
            "§aLIMPAR VEGETAÇÃO / NEVE §8- Remove mato, flores e neve sem quebrar o chão!\n" +
            "§2SUAVIZAR TERRENO (Smooth) §8- No formato Paisagismo, suaviza degraus bruscos em colinas naturais!")
            .button("§8Voltar ao Índice", ICON_BACK)
            .button("§8Fechar", ICON_CLOSE);
        const response = await form.show(player);
        if (response.selection === 0)
            await this.openTutorial(player);
    }
    static async showReplace(player) {
        const form = new ActionFormData()
            .title("§l§6SUBSTITUIÇÃO & PINCEL")
            .body("§e3 Formas de reformar e texturizar suas obras:\n\n" +
            "§b1. Troca Direta: §fClique no bloco ALVO e depois no bloco SUBSTITUTO (preserva rotação de escadas/lajes!).\n\n" +
            "§a2. Pincel de Texturização (Paleta %): §fAtive no menu Substituição para pintar paredes e pisos existentes usando as proporções (%) da sua Paleta!\n\n" +
            "§23. Modo Envelhecer Ruína: §fConverte automaticamente Tijolos de Pedra, Pedregulho, Ardósia e Pedra-Negra em suas variantes §aMusgosas e Rachadas§f!")
            .button("§8Voltar ao Índice", ICON_BACK)
            .button("§8Fechar", ICON_CLOSE);
        const response = await form.show(player);
        if (response.selection === 0)
            await this.openTutorial(player);
    }
    static async showTiersAndPowers(player) {
        const m = StaffConfig.maxBlocks;
        const form = new ActionFormData()
            .title("§l§eOS 11 CETROS E PODERES")
            .body(`§7Pedra (${m["arc_st:stone_staff"]}) | §6Cobre (${m["arc_st:copper_staff"]}): §fOxidar/Raspar + Espiral\n` +
            `§fFerro (${m["arc_st:iron_staff"]}) | §eOuro (${m["arc_st:gold_staff"]}) — §7Caixa 2P, Arco e Telhado\n` +
            `§dAmetista (${m["arc_st:amethyst_staff"]}): §fTelêmetro Óptico + Toroide 3D\n` +
            `§cRedstone (${m["arc_st:redstone_staff"]}): §fChave Mecânica (gira blocos)\n` +
            `§3Oceânico (${m["arc_st:prismarine_staff"]}): §fDrena água/lava + Todos os 17 Formatos\n` +
            `§bDiamante (${m["arc_st:diamond_staff"]}) | §5Netherite (${m["arc_st:netherite_staff"]})\n` +
            `§aEsmeralda (${m["arc_st:emerald_staff"]}): §fPaleta 9 + Troca sem desgaste\n` +
            `§bEco Astral (${m["arc_st:echo_staff"]}): §fBloco no Ar + §bINQUEBRÁVEL ∞`)
            .button("§8Voltar ao Índice", ICON_STAFF_TIER)
            .button("§8Fechar", ICON_CLOSE);
        const response = await form.show(player);
        if (response.selection === 0)
            await this.openTutorial(player);
    }
    static async showAdvanced(player) {
        const form = new ActionFormData()
            .title("§l§9SIMETRIA 4X, CALC & MAESTRIA")
            .body("§9Simetria Quádrupla (XZ) & Marco Central:\n" +
            "§8Espelhe nos 4 quadrantes simultaneamente e grave um Marco Central fixo no mundo para erguer castelos simétricos!\n\n" +
            "§3Calculadora de Obra & Lista de Compras:\n" +
            "§8Analisa seu Holograma ou Planta e mostra total de blocos, packs de 64 e quanto falta no estoque!\n\n" +
            "§67 Títulos de Maestria do Arquiteto:\n" +
            "§8Evolua de §7Aprendiz de Cantaria §8até §5Lenda Astral §8conforme constrói no mundo!")
            .button("§8Voltar ao Índice", ICON_BACK)
            .button("§8Fechar", ICON_CLOSE);
        const response = await form.show(player);
        if (response.selection === 0)
            await this.openTutorial(player);
    }
}
