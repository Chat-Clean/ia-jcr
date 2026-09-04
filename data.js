// =============================================================
//  DADOS DE NEGÓCIO — IA Avelloz JCR (JCR Motos — João Pessoa/PB)
//  Todo o conhecimento comercial e operacional que a IA usa.
//  A lógica (state machine, chamadas OpenAI) fica no index.js;
//  os prompts em prompts.js. Aqui só CONTEÚDO.
//
//  Fonte: PROMPT-MESTRE ULTRABLOQUEADO — SDR Virtual Avelloz JCR (V6:
//  diagnóstico obrigatório + aprofundamento emocional + diagnóstico
//  financeiro). Alinhamento da IA de 25/06/2026 aplicado.
// =============================================================

// -------------------------------------------------------------
//  A EMPRESA
// -------------------------------------------------------------
const EMPRESA_INFO = {
    nome: 'Avelloz JCR',
    apelidos: 'JCR Motos / Avelloz',
    tagline: 'Motos econômicas com facilidade de pagamento',
    descricao: 'Concessionária Avelloz em João Pessoa — PB (JCR Motos). Referência em moto econômica e facilidade de pagamento (cartão, financiamento, consórcio e à vista).',
    localizacao: 'João Pessoa–PB — Loja Matriz (Mangabeira) e Loja Geisel (Cuiá). Atendimento pelo WhatsApp e presencial nas lojas.',
    horarioSuporte: 'Segunda a sábado, em horário comercial.',
    consultorHumano: 'Eduardo Siqueira',
    site: ''
};

// -------------------------------------------------------------
//  CATÁLOGO DE MODELOS (preços promocionais)
//  Regras (ver prompts.js): só liberar modelo/preço APÓS o diagnóstico
//  mínimo. Nunca informar valor de PARCELA (transferir para humano).
//  Nunca mudar o nome dos produtos: AZ1, AZ125, AZX160.
//  ATENÇÃO: NUNCA dizer que o emplacamento está incluso — EXCETO na
//  AZX160, único modelo com valor com emplacamento fechado e liberado.
// -------------------------------------------------------------
const MODELOS = {
    az1: {
        nome: 'AZ1',
        cilindrada: '50cc',
        preco: 'R$ 10.990,00',
        precoNum: 10990,
        perfil: 'Economia máxima para o dia a dia na cidade.',
        descricao: 'Super econômica e confortável, chega a fazer até 50km com 1L de gasolina. Entrada USB e Tipo C pra carregar o celular. Aro 17 pra não passar arrastando nas lombadas. Porta-sacolas, baú espaçoso, painel digital (marcha, setas, km, gasolina e neutro) e freio a disco na dianteira.',
        cores: 'Branca, Preta e Vermelha',
        comparativo: 'Motoneta urbana estilo "cub", concorre com Pop/Biz/Jet e outras 50cc. Motor 49cc com 2,7 cv, câmbio semiautomático de 4 marchas, partida elétrica e pedal. Design moderno com LED, painel completo, freio a disco dianteiro, rodas aro 17 e entrada USB. Consumo médio entre 40 e 50 km/L, tanque de 5 litros. Opção econômica e funcional pro dia a dia na cidade.',
        imagem: 'https://www.instagram.com/p/DOGXesgjUYn/?igsh=bDR3Z29wNzZ0NGVw'
    },
    az125: {
        nome: 'AZ125',
        cilindrada: '125cc (Alfa)',
        preco: 'R$ 13.290,00',
        precoNum: 13290,
        perfil: 'Equilíbrio, conforto e potência para o dia a dia.',
        descricao: 'Moto completa, com conforto e potência. Injeção eletrônica, faróis full LED e freio CBS (mais segurança).',
        cores: 'Branca, Preta, Vermelha e Cinza (cor exclusiva)',
        comparativo: 'Moto urbana 125cc que concorre com Pop/Biz/Jet e outras 125cc. Motor 123,67 cm³ com injeção eletrônica, 8,5 cv, câmbio semiautomático de 4 marchas (sem embreagem). Design moderno, farol LED, painel digital, entradas USB (A e C), freios CBS, rodas aro 17. Foco em conforto, agilidade e baixo consumo.',
        imagem: 'https://www.instagram.com/p/DOGXk7ajUZK/?igsh=MWZqb3lrNm42ZmJ0cw%3D%3D'
    },
    az160: {
        nome: 'AZX160',
        cilindrada: '160cc',
        // Exceção do catálogo: o preço promocional da AZX160 NÃO inclui o emplacamento.
        preco: 'R$ 19.990,00',
        precoNum: 19990,
        precoComEmplacamento: 'R$ 20.990,00',
        precoComEmplacamentoNum: 20990,
        perfil: 'Potência, conforto e estilo — cidade e estrada.',
        descricao: 'Alta potência, confortável, econômica, já vem com proteção de carenagem e muito estilo. Entrada USB e Tipo C, farol full LED, pneus aro 19 dianteiro e 17 traseiro, painel digital, injeção eletrônica e freio CBS.',
        cores: 'Preta, Vermelha e Azul',
        comparativo: 'Moto trail de 160cc que concorre com Bros 160 e Crosser 150. Motor 161,9 cm³ com injeção eletrônica, 12,3 cv, câmbio de 5 marchas, consumo médio de ~35 km/L. Design aventureiro com rodas raiadas, protetores e bolha frontal, painel digital, iluminação full LED e entradas USB. Suspensão de longo curso, freios a disco com CBS, tanque de 13 litros. Garantia de 6 meses.',
        imagem: 'https://www.instagram.com/p/DOGXo0UjWtY/?igsh=NGkxYXRkNWJuNTJy'
    }
};

// -------------------------------------------------------------
//  FORMAS DE PAGAMENTO
//  Nunca informar valor de PARCELA (transferir para humano).
// -------------------------------------------------------------
const FORMAS_PAGAMENTO = {
    cartao: 'Cartão de crédito em até 24x.',
    financiamento: 'Financiamento com entrada ZERO em até 48x, dependendo do CPF. A gente consulta em 4 bancos; banco aprovou, sai com a moto no mesmo dia.',
    consorcio: 'Consórcio.',
    avista: 'À vista.'
};

// -------------------------------------------------------------
//  UNIDADES / LOJAS (identificar a loja é OBRIGATÓRIO antes de transferir)
//  As duas ficam em João Pessoa - PB.
// -------------------------------------------------------------
const LOJAS = {
    matriz: {
        nome: 'Loja Matriz',
        cidade: 'João Pessoa - PB',
        endereco: 'Rua Creusa Campos de Vasconcelos, 398 - Mangabeira',
        maps: 'https://maps.app.goo.gl/EJUDHfqixayzBUC58'
    },
    geisel: {
        nome: 'Loja Geisel',
        cidade: 'João Pessoa - PB',
        endereco: 'Rua Adalgisa Carneiro Cavalcante, 515 - Cuiá',
        maps: 'https://maps.app.goo.gl/we71dZpFUqvGcNL88'
    }
};

// -------------------------------------------------------------
//  PERFIS DE CLIENTE (o "gancho" da dor — como abordar cada caso).
//  Usado para a IA reconhecer a realidade do lead e mostrar a conta.
// -------------------------------------------------------------
const PERFIS = {
    app_aluga:      { nome: 'Roda de app — moto alugada', gancho: 'Descobrir quanto paga de aluguel por semana/mês: costuma ser maior que uma parcela, e ele paga sem nunca ficar com a moto. Mostrar que a parcela tende a ser menor e no fim a moto é DELE, pra trabalhar quanto quiser.' },
    app_comecando:  { nome: 'Roda de app — começando', gancho: 'Custo de oportunidade: cada dia sem moto é entrega que ele deixa de fazer e dinheiro que deixa de ganhar. A moto se paga rodando.' },
    app_trocar:     { nome: 'Roda de app — quer trocar', gancho: 'Foco em economia e confiabilidade: perguntar quanto gasta de manutenção e quanto a moto vive parada. Uma zero sem dor de cabeça de oficina compensa.' },
    depende_uber:   { nome: 'Depende de Uber/99', gancho: 'Somar o gasto diário/semanal de Uber e projetar no ano: o valor já daria pra ter a própria moto — e sem ficar com nada na mão.' },
    depende_onibus: { nome: 'Depende de ônibus', gancho: 'Somar a passagem mensal e o tempo perdido no ponto/lotado: liberdade de sair na hora que quiser.' },
    tem_carro:      { nome: 'Tem carro', gancho: 'Deixar o carro em casa no dia a dia e economizar combustível e estacionamento, usando a moto pra correria.' },
    esposa:         { nome: 'Compra pra esposa/família', gancho: 'Autonomia pra ela não depender de ninguém nem de Uber pra sair — muda a rotina de casa.' },
    primeira_moto:  { nome: 'Primeira moto', gancho: 'Realizar o sonho da própria moto com facilidade de pagamento (entrada zero em até 48x, dependendo do CPF).' }
};

// -------------------------------------------------------------
//  APROFUNDAMENTO EMOCIONAL — o tempo recuperado vira VIDA.
//  Quando o cliente diz quanto tempo perde (esperando ônibus/Uber, no
//  trânsito), a IA escolhe UM destes ganhos — o que combina com o perfil
//  dele — e devolve em pergunta. NUNCA os quatro de uma vez.
// -------------------------------------------------------------
const GANHOS_DE_TEMPO = {
    saude:       'Saúde e disposição — ex.: "Com essa meia hora a mais por dia, dava pra você ir pra academia com calma, ou até dormir um pouco mais. Isso já é saúde, né?"',
    familia:     'Família — ex.: "Esse tempo a mais podia ser um almoço ou jantar em casa com a família, sem correria. Faria diferença pra você?"',
    crescimento: 'Crescimento pessoal — ex.: "Dava até pra encaixar um curso ou uma faculdade nesse tempo que hoje se perde esperando condução. Você teria interesse nisso?"',
    lazer:       'Lazer e liberdade — ex.: "E nos dias de folga, decidir na hora ir pra praia ou fazer uma viagem, sem depender de horário de ninguém. Isso te faz falta hoje?"'
};

// -------------------------------------------------------------
//  BIBLIOTECA DE OBJEÇÕES (respostas consultivas)
//  A IA conhece isto para responder com segurança.
// -------------------------------------------------------------
const OBJECOES = {
    juros_financiamento: 'Reconheça o juros com honestidade, mas vire a chave: hoje ele já paga Uber/ônibus/aluguel todo mês e não fica com nada; na moto ele paga a parcela e a moto é DELE. Melhor pagar por algo que fica.',
    ta_caro:            'Ancore no que ele já gasta hoje com transporte (o número que ELE deu) projetado no ano, e no tempo que ele perde. O preço é promocional. Nunca informar valor de parcela — transferir para o consultor.',
    preciso_pensar:     'Faça sentido, sem pressão. Reforce a economia do dia a dia e convide a conhecer a moto pessoalmente na loja. Termine com uma pergunta que mantenha a conversa viva.',
    medo_credito:       'Tranquilize: a consulta é em 4 bancos e existe chance de entrada ZERO em até 48x, dependendo do CPF. Só coletar os dados pra simulação — quem confirma a aprovação é o consultor.',
    restricao_nome:     'Restrição no nome (SPC/Serasa) NÃO impede a tentativa: confirme com naturalidade que ele tem ciência de que isso pode influenciar na aprovação, e diga que mesmo assim a gente consegue analisar o caso dele. Nunca crave aprovação nem reprovação.',
    sem_cnh:            'CNH NUNCA é obrigatório pra comprar a moto. Tranquilize e siga normalmente com a simulação.',
    moto_usada_troca:   'A Avelloz NÃO trabalha com troca/aceite de moto usada. Conduza com simpatia para as formas de pagamento (cartão, financiamento, consórcio, à vista).',
    test_drive:         'A gente NÃO oferece test drive. Convide o cliente a conhecer a moto pessoalmente na loja.',
    moto_eletrica:      'A Avelloz NÃO vende moto elétrica — todos os modelos (AZ1, AZ125, AZX160) são a combustão (gasolina). Seja direto e honesto: não trabalhamos com elétrica. Não confunda com "partida elétrica" ou "injeção eletrônica", que são apenas itens de série das motos a combustão. Redirecione com naturalidade pra economia de combustível dos modelos que temos (alto rendimento km/L).',
    prazo_entrega:      'NUNCA prometa prazo de entrega. Diga que o consultor humano confirma os prazos certinhos.',
    marca_desconhecida: 'A Avelloz é referência em moto econômica e com facilidade de pagamento. Valorize a economia (km/L) e as condições, e já puxe a próxima pergunta.'
};

// -------------------------------------------------------------
//  DEPARTAMENTOS DE TRANSFERÊNCIA
//  A loja escolhida pelo cliente define o departamento (identificação
//  OBRIGATÓRIA). Além da nota interna com o resumo, a IA transfere o
//  ticket de verdade no ChatClean usando o ID do departamento
//  (campos forceTicketToDepartment + queueId da Push API).
//
//  Os IDs vêm de Configurações → Departamentos no painel da JCR:
//  Loja Geisel 249, Loja Matriz 250. Se um dia forem recriados, basta
//  sobrescrever pelo .env (DEPT_ID_GEISEL, DEPT_ID_MATRIZ) sem mexer no código.
// -------------------------------------------------------------
const DEPARTAMENTOS = {
    matriz: 'Loja Matriz',
    // O cliente costuma chamar pelo bairro — Geisel ou Cuiá são a MESMA unidade.
    geisel: 'Loja Geisel',
    // Porta de entrada: é ONDE O LEAD JÁ ESTÁ enquanto a IA atende. Não é
    // destino de transferência — quando a loja não é identificada, o ticket
    // simplesmente permanece aqui para a equipe tratar.
    entrada:  'Agente IA',
    // Só existe se a operação criar um departamento próprio de pós-venda.
    // Sem ID cadastrado, o cliente atual é encaminhado para a unidade dele.
    posvenda: 'Pós-venda'
};

// Lê um ID de departamento do .env, caindo no padrão quando não definido.
function idEnv(nomeVar, padrao) {
    const v = parseInt(process.env[nomeVar] || '', 10);
    return Number.isFinite(v) ? v : padrao;
}

// ID de cada departamento no CRM (null = sem ID conhecido → não transfere,
// só deixa a nota interna para o atendente encaminhar à mão).
const DEPARTAMENTO_IDS = {
    [DEPARTAMENTOS.matriz]:   idEnv('DEPT_ID_MATRIZ',    250),
    [DEPARTAMENTOS.geisel]:   idEnv('DEPT_ID_GEISEL',    249),
    [DEPARTAMENTOS.entrada]:  idEnv('DEPT_ID_AGENTE_IA', null),
    [DEPARTAMENTOS.posvenda]: idEnv('DEPT_ID_POSVENDA',  null)
};

// ID do departamento a partir do nome (null quando não cadastrado).
function departamentoId(departamento) {
    const id = DEPARTAMENTO_IDS[departamento];
    return Number.isFinite(id) ? id : null;
}

// Mapeia o texto da loja escolhida pelo cliente para o departamento do CRM.
// Geisel e Cuiá são a mesma loja; a Matriz também aparece como Mangabeira.
function lojaParaDepartamento(lojaTexto) {
    const t = String(lojaTexto || '').toLowerCase();
    if (/geisel|cui[aá]|adalgisa/.test(t)) return DEPARTAMENTOS.geisel;
    if (/matriz|mangabeira|creusa/.test(t)) return DEPARTAMENTOS.matriz;
    return null;
}

// -------------------------------------------------------------
//  CAMPOS DE QUALIFICAÇÃO (ordem do fluxo SDR Avelloz JCR)
//  O diagnóstico da realidade atual vem ANTES de modelo/preço, e o
//  diagnóstico FINANCEIRO vem antes da coleta de dados da simulação.
//  O index.js usa isto na state machine (flow.js).
// -------------------------------------------------------------
const CAMPOS_QUALIFICACAO = [
    'nome', 'finalidade', 'transporteAtual', 'gastoMensal', 'situacaoMoto', 'tempoPerdido',
    'modeloInteresse', 'formaPagamento', 'entrada', 'parcelaDesejada', 'parcelaMaxima',
    'restricaoNome', 'loja'
];

// Dados coletados EM BLOCO para a simulação (não entram na ordem 1-a-1 do fluxo).
const CAMPOS_SIMULACAO = ['nomeCompleto', 'cpf', 'dataNascimento', 'telefone', 'cnh', 'renda', 'corModelo'];

module.exports = {
    EMPRESA_INFO,
    MODELOS,
    FORMAS_PAGAMENTO,
    LOJAS,
    PERFIS,
    GANHOS_DE_TEMPO,
    OBJECOES,
    DEPARTAMENTOS,
    DEPARTAMENTO_IDS,
    departamentoId,
    lojaParaDepartamento,
    CAMPOS_QUALIFICACAO,
    CAMPOS_SIMULACAO
};
