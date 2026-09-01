// =============================================================
//  FLOW — lógica PURA do fluxo de qualificação do SDR Avelloz JCR.
//  Compartilhada entre o servidor (index.js) e o tester local
//  (test-chat.js / sim-lead.js) para não haver drift. Sem I/O, sem OpenAI.
//
//  O fluxo é um GUIA: o diagnóstico da realidade atual (transporte + gasto +
//  situação de moto + tempo perdido + o que ele faria com esse tempo) vem
//  ANTES de liberar modelo/preço; o diagnóstico FINANCEIRO (forma de
//  pagamento, entrada, parcela desejada, teto de parcela e restrição no nome)
//  vem antes da coleta de dados da simulação. A ordem forte está no SYSTEM
//  (prompts.js); aqui só ditamos a próxima "dica" de campo a coletar.
// =============================================================

// Ordem oficial do fluxo JCR:
// diagnóstico → emocional → modelo → diagnóstico financeiro → loja.
const CAMPOS = [
    'finalidade', 'transporteAtual', 'gastoMensal', 'situacaoMoto', 'tempoPerdido', 'ganhoTempo',
    'modeloInteresse',
    'formaPagamento', 'entrada', 'parcelaDesejada', 'parcelaMaxima', 'restricaoNome',
    'loja'
];

// Dados coletados EM BLOCO para a simulação (capturados oportunamente, não
// bloqueiam o fluxo 1-a-1). O nome também é capturado aqui quando surge.
const CAMPOS_EXTRAS = ['nome', 'nomeCompleto', 'cpf', 'dataNascimento', 'telefone', 'cnh', 'renda', 'corModelo', 'cienciaRestricao'];

// Modelo citado num texto (usado para saber qual moto a IA já apresentou).
// A ordem importa: AZX160 e AZ125 são testados antes de AZ1, senão "AZ1"
// casaria dentro de "AZ125".
function detectarModeloMencionado(texto) {
    if (!texto) return null;
    if (/\bAZX\s?-?\s?160\b/i.test(texto)) return 'AZX160';
    if (/\bAZ\s?-?\s?125\b/i.test(texto)) return 'AZ125';
    if (/\bAZ\s?-?\s?1\b/i.test(texto))   return 'AZ1';
    return null;
}

// -------------------------------------------------------------
//  CHECAGEM DE COERÊNCIA FINANCEIRA (etapa 6e do prompt-mestre)
//  Converte "uns 30 por dia", "250 por semana", "R$ 600 no mês" num valor
//  MENSAL aproximado, para comparar o que o cliente JÁ GASTA hoje com a
//  parcela que ele diz topar pagar. Se ele já gasta mais do que quer pagar
//  numa moto que fica pra ele, a conta não fecha e a IA tem que confrontar.
//  Retorna null quando não dá pra ler um número com segurança.
// -------------------------------------------------------------
function valorMensalAprox(texto) {
    if (!texto) return null;
    const t = String(texto).toLowerCase().replace(/\s+/g, ' ');

    // Primeiro número com cara de dinheiro (aceita 1.200,50 / 1200 / 250,00).
    const m = t.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/);
    if (!m) return null;
    const valor = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) return null;

    // Período declarado depois do número (dia/semana/quinzena/mês/ano).
    if (/\b(por dia|ao dia|diário|diaria|diária|por dia útil|dia)\b/.test(t)) return valor * 22;   // dias úteis
    if (/\b(por semana|semanal|semana)\b/.test(t))                            return valor * 4.3;
    if (/\b(quinzena|quinzenal)\b/.test(t))                                   return valor * 2;
    if (/\b(por ano|anual|ano)\b/.test(t))                                    return valor / 12;
    return valor; // sem período explícito → assume mensal (é como a pergunta é feita)
}

// A conta bate? Compara gasto atual (mensal) x parcela que ele topa pagar.
// Retorna { gasto, parcela, incoerente } — incoerente = ele já gasta MAIS
// hoje do que quer pagar numa moto que fica pra ele.
function checarCoerenciaFinanceira(leadData) {
    const gasto = valorMensalAprox(leadData.gastoMensal);
    const parcela = valorMensalAprox(leadData.parcelaDesejada);
    if (gasto === null || parcela === null) return { gasto, parcela, incoerente: false };
    // Margem de 5% pra não brigar por diferença de arredondamento.
    return { gasto, parcela, incoerente: gasto > parcela * 1.05 };
}

// State machine: retorna o próximo campo a coletar (com a instrução p/ o modelo)
// ou null quando a qualificação está completa (marca leadData.qualificacaoCompleta).
function determinarProximoCampo(leadData) {
    // ATALHO: o cliente disse que tem pressa / quer ir direto ao assunto. O funil
    // inteiro é abandonado e só a LOJA importa, porque é o único campo obrigatório
    // para transferir de verdade (sem ela o ticket não sai da fila do Agente IA).
    // Ligado em index.js quando querAvancar / PEDE_AGILIDADE dispara.
    if (leadData.modoAtalho) {
        if (!leadData.loja) return { campo: 'loja', pergunta: 'O cliente pediu OBJETIVIDADE. NÃO faça diagnóstico, NÃO pergunte gasto, transporte, tempo ou forma de pagamento e NÃO ofereça modelo. Pergunte SÓ em qual unidade ele quer ser atendido, citando as duas (Loja Matriz, em Mangabeira, e Loja Geisel, no Cuiá). Uma frase curta, nada mais.' };
        leadData.qualificacaoCompleta = true;
        return null;
    }

    // A IA já recomendou uma moto e o cliente SEGUIU ADIANTE (falou de pagamento,
    // escolheu loja ou passou dados) sem dizer "quero essa" com todas as letras.
    // Sem isto o fluxo fica preso em modeloInteresse: a cada mensagem a instrução
    // volta a ser "recomende um modelo", e a IA acaba trocando de moto sozinha,
    // contradizendo o preço que ela mesma acabou de dar.
    // Também adota quando a moto já apareceu em DUAS mensagens da IA sem o cliente
    // recusar: senão ela fica presa em "é essa que você quer levar?" a cada turno.
    if (!leadData.modeloInteresse && leadData.modeloApresentado) {
        const vezesApresentada = (leadData.conversationHistory || [])
            .filter(h => h.role === 'assistant' && detectarModeloMencionado(h.content) === leadData.modeloApresentado)
            .length;
        if (vezesApresentada >= 2 || leadData.formaPagamento || leadData.loja || leadData.cpf || leadData.corModelo) {
            leadData.modeloInteresse = leadData.modeloApresentado;
        }
    }

    // UMA pergunta por vez, sempre. Perguntas duplas ("quanto gasta E quanto tempo
    // perde?") fazem o cliente responder só a segunda parte: o campo continua vazio,
    // a IA repete a pergunta e ele se irrita.
    if (!leadData.finalidade)      return { campo: 'finalidade',      pergunta: 'Pergunte APENAS pra que ele quer a moto (trabalhar, economizar, passear, pra esposa) — passo 2, interesse. Não emende nenhuma outra pergunta na mesma mensagem.' };
    if (!leadData.transporteAtual) return { campo: 'transporteAtual', pergunta: 'Pergunte APENAS como ele se locomove HOJE: carro, Uber, ônibus, carona ou moto alugada (passo 3 — diagnóstico). Uma coisa de cada vez.' };
    if (!leadData.gastoMensal)     return { campo: 'gastoMensal',     pergunta: 'Pergunte APENAS quanto ele gasta por mês nesse transporte, fazendo ele dizer o número em reais. NÃO pergunte junto sobre tempo perdido no trânsito nem qualquer outra coisa — só o valor.' };
    if (!leadData.situacaoMoto)    return { campo: 'situacaoMoto',    pergunta: 'Descubra se ele já tem moto e a situação (própria, alugada, velha, manutenção cara). Se roda de app, pergunte quanto paga de aluguel por semana/mês.' };
    if (!leadData.tempoPerdido)    return { campo: 'tempoPerdido',    pergunta: 'Pergunte APENAS quanto TEMPO por dia ele sente que perde hoje esperando Uber, no ponto de ônibus ou parado no trânsito. Faça ele dizer o número (minutos/horas). Só isso nesta mensagem.' };
    // APROFUNDAMENTO EMOCIONAL: o tempo recuperado vira vida. Um exemplo só,
    // o que combina com o perfil dele, sempre terminando em pergunta.
    if (!leadData.ganhoTempo)      return { campo: 'ganhoTempo',      pergunta: `O cliente já disse que perde ${leadData.tempoPerdido} por dia. AGORA faça o aprofundamento emocional: transforme esse tempo em ganho concreto da vida dele e pergunte o que ele faria com esse tempo de volta. Escolha UM exemplo só — o que mais combina com o perfil dele (saúde/academia/dormir mais, almoçar com a família, encaixar um curso ou faculdade, ou liberdade pra ir pra praia/viajar na folga). NÃO liste os quatro. NÃO fale de preço nem de modelo ainda.` };

    if (!leadData.modeloInteresse) return { campo: 'modeloInteresse', pergunta: leadData.modeloApresentado
        ? `Você JÁ recomendou a ${leadData.modeloApresentado} e JÁ mostrou a conta do gasto anual. NÃO recomende outro modelo, NÃO repita o preço e NÃO refaça o cálculo: apenas confirme, numa pergunta curta, se é essa mesma que ele quer levar.`
        : 'Diagnóstico feito: mostre a conta (o gasto dele projetado no ano) UMA vez e recomende o modelo que encaixa (AZ1 economia, AZ125 equilíbrio, AZX160 potência), mandando a descrição e o link da imagem. Confirme explicitamente qual modelo ele quer.' };

    // --- DIAGNÓSTICO FINANCEIRO (passo 6) ---
    // Nenhum destes campos bloqueia o fechamento depois que o cliente escolheu a
    // unidade: quem fecha a condição é o consultor da loja. Insistir aqui faria a
    // IA voltar atrás e reperguntar dinheiro depois de o cliente já ter decidido
    // onde comprar.
    if (!leadData.loja) {
        if (!leadData.formaPagamento)  return { campo: 'formaPagamento',  pergunta: 'Passo 6a: pergunte como ele pensa em fazer — cartão em até 24x, financiamento (com chance de entrada ZERO em até 48x, dependendo do CPF), consórcio ou à vista. Só isso nesta mensagem.' };
        // A entrada só faz sentido no financiamento.
        if (/financ/i.test(String(leadData.formaPagamento)) && !leadData.entrada)
            return { campo: 'entrada',        pergunta: 'Passo 6b: pergunte APENAS se ele já pensou em dar alguma entrada ou se prefere ver a opção de entrada zero. Não fale de valor de parcela.' };
        if (!leadData.parcelaDesejada) return { campo: 'parcelaDesejada', pergunta: 'Passo 6c: pergunte APENAS se ele já tem uma ideia de quanto ficaria bom de parcela por mês pra ele. Você está PERGUNTANDO o número dele — NUNCA informe nem estime valor de parcela.' };
        if (!leadData.parcelaMaxima)   return { campo: 'parcelaMaxima',   pergunta: 'Passo 6d: agora pergunte APENAS o MÁXIMO que ele conseguiria pagar por mês sem apertar. É uma pergunta diferente da anterior (o que ele quer pagar x o teto dele) — deixe isso claro com naturalidade.' };
        if (!leadData.restricaoNome)   return { campo: 'restricaoNome',   pergunta: 'Passo 6f: pergunte com leveza se ele tem alguma restrição no nome hoje (SPC/Serasa), deixando claro que pode falar tranquilo, que é só pra agilizar a simulação. Se ele disser que tem, confirme na mesma linha se ele já sabe que isso pode influenciar na aprovação — e tranquilize dizendo que mesmo assim a gente analisa o caso dele.' };
        return { campo: 'loja',             pergunta: 'Pergunte qual unidade fica melhor pra ele, citando SEMPRE as DUAS: Loja Matriz (Rua Creusa Campos de Vasconcelos, 398 - Mangabeira) e Loja Geisel (Rua Adalgisa Carneiro Cavalcante, 515 - Cuiá). Identificar a loja é OBRIGATÓRIO antes de transferir.' };
    }

    leadData.qualificacaoCompleta = true;
    return null;
}

// Campos de ESCOLHA que mudam ao longo da conversa: o último valor informado
// vence (ex.: perguntou o preço da AZ1 mas depois escolheu a AZ125; trocou a
// forma de pagamento, a loja ou o valor de parcela que topa pagar). Diferente
// dos fatos do diagnóstico, que ficam.
const MUTAVEIS = ['modeloInteresse', 'formaPagamento', 'loja', 'corModelo', 'cnh', 'entrada', 'parcelaDesejada', 'parcelaMaxima'];

// Aplica os campos extraídos ao leadData. Por padrão NÃO sobrescreve o que já
// foi coletado — exceto os campos MUTAVEIS (último valor vence) e os que o
// cliente está CORRIGINDO explicitamente (extraido.correcao = lista de campos).
function aplicarCampos(leadData, extraido) {
    if (!extraido) return;
    const correcoes = Array.isArray(extraido.correcao) ? extraido.correcao : [];
    for (const c of [...CAMPOS, ...CAMPOS_EXTRAS]) {
        const v = extraido[c];
        if (v === null || v === undefined || v === '') continue;
        if (!leadData[c] || correcoes.includes(c) || MUTAVEIS.includes(c)) {
            leadData[c] = v;
        }
    }
}

// Detecta o PERFIL do cliente (para o gancho de dor) por palavras-chave.
// Ordem importa: casos de app/aluguel são checados antes dos genéricos.
const PERFIL_KEYWORDS = [
    ['app_aluga',      ['alug', 'aluguel', 'alugada', 'locada']],
    ['app_comecando',  ['começando', 'comecando', 'vou começar', 'quero rodar', 'começar a rodar']],
    ['app_trocar',     ['trocar a moto', 'trocar minha moto', 'moto velha', 'moto parada', 'manutenção cara', 'manutencao cara']],
    ['esposa',         ['esposa', 'minha mulher', 'namorada', 'pra ela', 'pra minha filha', 'pra minha esposa']],
    ['depende_uber',   ['uber', '99', 'noventa e nove', 'aplicativo de transporte', 'indriver', 'táxi', 'taxi']],
    ['depende_onibus', ['ônibus', 'onibus', 'passagem', 'transporte público', 'transporte publico', 'busão', 'busao']],
    ['tem_carro',      ['carro', 'meu carro', 'gasolina do carro', 'combustível do carro', 'estacionamento']],
    ['primeira_moto',  ['primeira moto', 'nunca tive moto', 'nunca tive uma moto', 'minha primeira']]
];
function detectarPerfil(texto) {
    if (!texto) return null;
    const t = texto.toLowerCase();
    for (const [key, kws] of PERFIL_KEYWORDS) {
        if (kws.some(kw => t.includes(kw))) return key;
    }
    return null;
}

module.exports = {
    CAMPOS,
    CAMPOS_EXTRAS,
    determinarProximoCampo,
    aplicarCampos,
    detectarPerfil,
    detectarModeloMencionado,
    valorMensalAprox,
    checarCoerenciaFinanceira
};
