// =============================================================
//  FLOW — lógica PURA do fluxo de qualificação do SDR Avelloz.
//  Compartilhada entre o servidor (index.js) e o tester local
//  (test-chat.js / sim-lead.js) para não haver drift. Sem I/O, sem OpenAI.
//
//  O fluxo é um GUIA: o diagnóstico da realidade atual (transporte + gasto +
//  situação de moto) vem ANTES de liberar modelo/preço. A ordem forte está no
//  SYSTEM (prompts.js); aqui só ditamos a próxima "dica" de campo a coletar.
// =============================================================

// Ordem oficial do fluxo Avelloz (diagnóstico → modelo → pagamento → loja).
const CAMPOS = ['finalidade', 'transporteAtual', 'gastoMensal', 'situacaoMoto', 'modeloInteresse', 'formaPagamento', 'loja'];

// Dados coletados EM BLOCO para a simulação (capturados oportunamente, não
// bloqueiam o fluxo 1-a-1). O nome também é capturado aqui quando surge.
const CAMPOS_EXTRAS = ['nome', 'nomeCompleto', 'cpf', 'dataNascimento', 'telefone', 'cnh', 'corModelo'];

// State machine: retorna o próximo campo a coletar (com a instrução p/ o modelo)
// ou null quando a qualificação está completa (marca leadData.qualificacaoCompleta).
function determinarProximoCampo(leadData) {
    if (!leadData.finalidade)      return { campo: 'finalidade',      pergunta: 'Pergunte pra que ele quer a moto (trabalhar, economizar, passear, pra esposa) e se já viu algum modelo nosso (passo 2 — interesse).' };
    if (!leadData.transporteAtual) return { campo: 'transporteAtual', pergunta: 'Pergunte como ele se locomove HOJE: carro, Uber, ônibus, carona ou moto alugada (passo 3 — diagnóstico). Uma coisa de cada vez.' };
    if (!leadData.gastoMensal)     return { campo: 'gastoMensal',     pergunta: 'Pergunte quanto ele gasta por mês nesse transporte (faça ele dizer o número em reais) e o quanto de tempo perde esperando/no trânsito.' };
    if (!leadData.situacaoMoto)    return { campo: 'situacaoMoto',    pergunta: 'Descubra se ele já tem moto e a situação (própria, alugada, velha, manutenção cara). Se roda de app, pergunte quanto paga de aluguel por semana/mês.' };
    if (!leadData.modeloInteresse) return { campo: 'modeloInteresse', pergunta: 'Diagnóstico feito: mostre a conta (o gasto dele projetado no ano) e recomende o modelo que encaixa (AZ1 economia, AZ125 equilíbrio, AZX160 potência). Confirme qual interessou.' };
    if (!leadData.formaPagamento)  return { campo: 'formaPagamento',  pergunta: 'Pergunte qual forma de pagamento faz mais sentido: cartão (até 21x), financiamento (entrada zero em até 48x dependendo do CPF), consórcio ou à vista.' };
    if (!leadData.loja)            return { campo: 'loja',            pergunta: 'Pergunte qual unidade fica melhor pra ele: Matriz, Malvinas (Campina Grande) ou Monteiro. Identificar a loja é OBRIGATÓRIO antes de transferir.' };
    leadData.qualificacaoCompleta = true;
    return null;
}

// Campos de ESCOLHA que mudam ao longo da conversa: o último valor informado
// vence (ex.: perguntou o preço da AZ1 mas depois escolheu a AZ125; trocou a
// forma de pagamento ou a loja). Diferente dos fatos do diagnóstico, que ficam.
const MUTAVEIS = ['modeloInteresse', 'formaPagamento', 'loja', 'corModelo', 'cnh'];

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

module.exports = { CAMPOS, CAMPOS_EXTRAS, determinarProximoCampo, aplicarCampos, detectarPerfil };
