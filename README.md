# IA Avelloz JCR — IA Externa (SDR de motos)

Consultor virtual da **Avelloz JCR** ("JCR Motos", concessionária Avelloz em João Pessoa–PB), no padrão de IA externa da plataforma **ChatClean** (Webhook de entrada + Push API de saída). Roda num servidor Node.js próprio: acolhe o cliente, faz o **diagnóstico da realidade atual** (como se locomove hoje, quanto gasta e quanto tempo perde), aprofunda no emocional (o que ele faria com esse tempo de volta), mostra a conta da economia, recomenda o modelo certo, informa **preço promocional**, faz o **diagnóstico financeiro** (forma de pagamento, entrada, parcela desejada, teto e restrição no nome), coleta os dados para simulação e **transfere para o consultor humano da loja escolhida**.

> Mesma arquitetura da IA externa da Avelloz Campina, usada como template. O **transporte** continua sendo a plataforma ChatClean; o que muda é a **persona, os dados e o fluxo** (V6 do prompt-mestre da JCR).

## Arquitetura

```
Cliente WhatsApp → ChatClean CRM ──POST /webhook──▶ servidor Node.js
                                                       ↓ GPT-4o-mini (extrai + responde)
Cliente WhatsApp ◀── ChatClean Push API ◀──POST CC_PUSH_URL {number, body, externalKey}
```

O ChatClean cuida só do transporte. Toda a inteligência (persona, diagnóstico, objeções, transbordo) roda aqui.

## O que o bot faz

- **Persona oficial JCR:** consultor humano, tom de WhatsApp, sem markdown, emoji com parcimônia, SEMPRE termina com uma pergunta, anti-jailbreak, nunca revela que é IA. Fala como "nós da Avelloz" / "aqui na JCR".
- **Diagnóstico ANTES do produto (regra inegociável):** não revela preço, modelo nem condição antes de entender transporte atual + gasto mensal + situação de moto. Se o cliente pede preço cedo, redireciona com naturalidade.
- **Aprofundamento emocional:** depois que o cliente diz quanto **tempo** perde por dia, a IA transforma esse tempo em ganho concreto de vida — saúde, família, estudo ou lazer — escolhendo **um** exemplo conforme o perfil, nunca os quatro.
- **Diagnóstico financeiro (antes da simulação):** forma de pagamento → entrada (se financiamento) → parcela desejada → teto de parcela → **checagem de coerência** → restrição no nome + ciência do impacto.
- **Preços liberados** (após o diagnóstico): AZ1, AZ125, AZX160 — sempre como preço promocional. **Nunca informa valor de parcela** (transfere pro humano) e **nunca diz que o emplacamento está incluso** — com uma única exceção: na **AZX160** a IA informa os dois valores (sem e com emplacamento).
- **Fechamento:** identifica a loja (Matriz ou Geisel — obrigatório), coleta os dados de simulação (CPF, nascimento, nome, telefone, CNH, **renda**, cor/modelo) e **transfere o ticket para o departamento da loja escolhida**.
- **Regras específicas:** não aceita moto usada na troca, não faz test drive, nunca promete prazo de entrega, CNH não é obrigatório pra comprar. Peças/revisão/garantia são encaminhados ao time da loja (a IA não diagnostica defeito nem cota serviço).
- **Mídia:** áudio transcrito (Whisper); imagem lida por visão (gpt-4o); documento/vídeo têm acuse humanizado.
- **Estado durável:** conversas no Redis (fallback em memória) + follow-up/transferência por sumiço.

## Checagem de coerência financeira

Regra 6e do prompt-mestre: se o cliente **já gasta hoje mais** do que diz topar pagar de parcela, a IA precisa confrontar — nunca aceitar o valor menor calado.

Isso não fica só no prompt: `flow.js` normaliza os dois valores para uma base **mensal** (`valorMensalAprox` entende "30 por dia", "250 por semana", "R$ 600 por mês") e `checarCoerenciaFinanceira` decide se a conta fecha. Quando não fecha, o rodapé dinâmico manda a IA apontar a inconsistência com os números reais do cliente — uma vez só (`leadData.coerenciaConfrontada`).

Exemplo: aluguel de moto de "250 por semana" vira **R$ 1.075/mês**; se ele disser que só topa R$ 400 de parcela, a IA confronta.

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.js` | Servidor Express: webhook, Push, state machine, Whisper, visão, follow-up/sumiço, transbordo por loja |
| `data.js` | Conteúdo de negócio (empresa, modelos+preços, pagamento, lojas, perfis, ganhos de tempo, objeções, departamentos + IDs) |
| `prompts.js` | `SYSTEM_SDR` (prompt-mestre JCR V6) + extração (temp 0) + resposta (temp 0.7) |
| `flow.js` | State machine de qualificação + checagem de coerência financeira (pura, compartilhada com os testers) |
| `horario.js` | Expediente do time → modo plantão |
| `store.js` | Estado das conversas em Redis + fallback em memória |
| `pipeline.js` | Oportunidades no CRM — opcional, **desligado por padrão** (fechamento é transferir para o consultor) |

## Fluxo de qualificação (guia)

Acolher (conhece a marca?) → interesse (pra que quer a moto) → **diagnóstico** (transporte hoje → gasto mensal → situação de moto → tempo perdido → **o que faria com esse tempo**) → tocar na dor / mostrar a conta → recomendar modelo + preço → **diagnóstico financeiro** (pagamento → entrada → parcela desejada → teto → coerência → restrição) → coletar dados de simulação → **identificar a loja** → transferir pro consultor.

## Modelos (preços promocionais)

| Modelo | Cilindrada | Preço |
|---|---|---|
| AZ1 | 50cc | R$ 10.990,00 |
| AZ125 | 125cc (Alfa) | R$ 13.290,00 |
| AZX160 | 160cc | R$ 19.990,00 (sem emplacamento) / R$ 20.990,00 (com emplacamento) |

Formas de pagamento: cartão em até **24x**, financiamento com entrada **ZERO** em até 48x (dependendo do CPF, consulta em **4 bancos**), consórcio e à vista. A IA nunca informa valor de parcela.

## Unidades (João Pessoa/PB)

- **Loja Matriz** — Rua Creusa Campos de Vasconcelos, 398 - Mangabeira
- **Loja Geisel** — Rua Adalgisa Carneiro Cavalcante, 515 - Cuiá

## Transferência entre departamentos

A loja que o **cliente escolhe** define o departamento de destino. Ao qualificar o lead, a IA faz três coisas no ticket, nesta ordem:

1. grava a **nota interna** com o resumo completo do lead;
2. **transfere o ticket** para a fila da unidade, via `forceTicketToDepartment: true` + `queueId: <ID>` da Push API;
3. manda o resumo pro WhatsApp interno (se `EQUIPE_NUMERO` estiver definido).

| Departamento | ID | Quando |
|---|---|---|
| Agente IA | — | porta de entrada: onde o lead nasce e fica enquanto a IA atende |
| Loja Geisel | 249 | cliente escolheu a Loja Geisel (ou citou Cuiá) |
| Loja Matriz | 250 | cliente escolheu a Matriz (ou citou Mangabeira) |

Os IDs vêm de **Configurações → Departamentos** no painel e ficam em `data.js`; se forem recriados, sobrescreva pelo `.env` (`DEPT_ID_GEISEL`, `DEPT_ID_MATRIZ`).

Se o cliente não chegar a escolher uma unidade, **não há transferência**: o ticket permanece no Agente IA, com a nota do resumo, para a equipe direcionar. Cliente antigo pedindo pós-venda é encaminhado para a unidade onde comprou; se a operação criar um departamento próprio de pós-venda, basta preencher `DEPT_ID_POSVENDA`.

`TRANSFERIR_DEPARTAMENTO=false` desliga a transferência automática e volta ao comportamento em que o atendente encaminha à mão a partir da nota interna.

A IA **só confirma a transferência ao cliente depois que ela acontece**. A ordem em cada fechamento é: grava a nota interna, tenta transferir, e só então responde. Se o CRM recusar a transferência, a IA responde sem prometer o repasse e a equipe recebe o resumo com um alerta para encaminhar à mão.

**Se o ticket não muda de fila:** a plataforma só reposiciona ticket que está *fechado* ou é *primeiro contato* — um ticket já em atendimento tende a ficar onde está. Nesse caso ligue `TRANSFERIR_FECHANDO=true`, que fecha o ticket no mesmo push (`forceTicketToClosed`), o gatilho documentado para ele reabrir já no departamento certo.

**Para diagnosticar sem refazer a conversa**, use o endpoint administrativo, que devolve a resposta crua do CRM:

```
GET /diag/transferir?key=ADMIN_KEY&numero=5583999999999&loja=geisel
```

Ele responde `transferiu`, `idUsado`, `motivo` e `respostaDoCRM`. Não envia nada ao cliente — a nota é interna. `GET /diag` mostra a configuração ativa em `transferenciaDepartamento`.

## Sumiço do cliente

Regra da JCR: **5 minutos sem resposta → transfere pro departamento Loja Matriz**. Na prática o vencimento faz duas coisas:

- manda a mensagem de reativação, e
- quando o lead **já tem conteúdo** (ou já levou uma reativação antes e continuou mudo), transfere o ticket para a unidade escolhida — sem escolha, para a **Loja Matriz** — e a IA sai de cena.

Um lead que só disse "oi" e sumiu **não** é transferido de primeira: leva a reativação e ganha mais uma janela, pra fila da Matriz não encher de ticket vazio. Ajuste com `MINUTOS_INATIVIDADE` (padrão 5) e desligue a transferência com `TRANSFERIR_NO_SUMICO=false`.

## Rodar local

```bash
npm install
cp .env.example .env      # preencher OPENAI_API_KEY (e CC_PUSH_URL p/ o servidor)
npm run chat              # conversa interativa no terminal (só precisa da OpenAI)
npm run sim               # simulação de qualificação completa (motoboy/moto alugada)
npm start                 # sobe o servidor (webhook/Push)
```

`GET /health` → `{ status: 'ok' }` · `GET /leads` e `GET /diag` exigem `ADMIN_KEY`.

## Deploy (Hostinger)

1. Subir o projeto para o servidor (git ou upload) e `npm install --omit=dev` (ou `npm ci`).
2. Definir as variáveis de ambiente do `.env.example` (OpenAI, `CC_PUSH_URL`, `EQUIPE_NUMERO`, `REDIS_URL`, `REDIS_PREFIX=iajcr`, `DEPT_ID_MATRIZ`, `DEPT_ID_GEISEL`).
3. Manter o processo vivo (PM2 recomendado): `pm2 start index.js --name iajcr`.
4. Expor a porta `3000` atrás do proxy/HTTPS do domínio.
5. No painel ChatClean da conta da JCR (Configurações → API/Webhook):
   - **URL Webhook** = `https://SEU_DOMINIO/webhook` e **marcar o evento de mensagem recebida** (sem evento, nada dispara).
   - **Token de autenticação** = o mesmo valor de `WEBHOOK_SECRET` (o ChatClean envia como header `Authorization`).
   - `CC_PUSH_URL` é gerada nessa mesma tela (Adicionar) — cuidado: ela regenera quando a sessão de WhatsApp reconecta.
6. Teste com o número em `IA_ALLOWED_CONTACTS` antes do go-live; para abrir a todos, esvazie a lista.

> Também roda em Docker (`Dockerfile` incluso, porta 3000) caso prefira container.

## Decisões da operação (01/09/2026)

- **Departamentos**: Loja Geisel `#249` e Loja Matriz `#250` — já são o padrão em `data.js`.
- **Expediente**: mantido o herdado do template (seg–sex, 09h–18h, fuso `America/Recife`). Fora disso a IA entra em modo plantão e agenda retorno para o próximo dia útil. Revisar se a JCR passar a atender sábado.
- **Oficina / contato de pós-venda**: desativado por enquanto. Peças, revisão e garantia são encaminhados ao time da loja — a IA não diagnostica defeito nem cota serviço. Se um dia houver telefone direto, é só reintroduzir o bloco `OFICINA` em `data.js`.

---

*Avelloz JCR — JCR Motos | João Pessoa/PB | IA Externa (via ChatClean)*
