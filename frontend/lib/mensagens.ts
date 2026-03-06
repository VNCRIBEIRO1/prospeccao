// ============================================
// Mensagens do Bot — Templates centralizados
// REESTRUTURADO v2: Fluxo completo de triagem automatizada
// Dúvidas com sub-menus, projetos personalizados, restart automático
// Objetivo: máxima captação sem interferência humana
// ============================================

// ============================================
// TIPO: Definição de etapa do fluxo
// ============================================
export interface EtapaFluxo {
  /** Textos a enviar (se múltiplos, envia em sequência com delay) */
  textos: string[];
  /** Botões interativos para esta etapa (null = etapa terminal sem menu) */
  botoes: BotaoInterativo[] | null;
  /** Texto do rodapé dos botões */
  rodape?: string;
  /** Se true, esta é uma etapa terminal (reinicia em nova mensagem) */
  terminal?: boolean;
}

export interface BotaoInterativo {
  id: string;
  texto: string;
  descricao?: string;
}

// ============================================
// ETAPAS TERMINAIS — Ao receber nova mensagem, reinicia de msg1
// ============================================
export const ETAPAS_TERMINAIS = [
  'msg3c', 'msg2b_fim', 'msg_humano',
  'atendimento_manual', 'bloqueado',
  'msg_finalizado', 'msg_aguardando',
  'msg_enviar_docs',
];

// ============================================
// FLUXO COMPLETO — Cada etapa com conteúdo + botões
// ============================================
export const FLUXO: Record<string, EtapaFluxo> = {

  // ─────────────────────────────────────────
  // INICIO — Alias de msg1 (default do Prisma)
  // ─────────────────────────────────────────
  inicio: {
    textos: [
      `Olá! 👋 Tudo bem?

Você sabia que escritórios de advocacia com site profissional recebem até *3x mais contatos* de clientes novos?

🖥️ Criamos *sites premium + chatbot inteligente* para advogados:
✅ Chatbot que atende e capta clientes 24h
✅ Blog jurídico com artigos da sua área
✅ Domínio .adv.br já incluso
✅ Suporte e garantia incluídos

Tudo isso por apenas *R$ 299/ano* 👇`,
    ],
    botoes: [
      { id: 'msg1_sim', texto: '✅ Quero conhecer' },
      { id: 'msg1_site', texto: '🌐 Já tenho site' },
      { id: 'msg1_nao', texto: '⏳ Agora não' },
    ],
    rodape: 'Toque em uma opção acima 👆',
  },

  // ─────────────────────────────────────────
  // MSG1 — Saudação inicial
  // ─────────────────────────────────────────
  msg1: {
    textos: [
      `Olá! 👋 Tudo bem?

Você sabia que escritórios de advocacia com site profissional recebem até *3x mais contatos* de clientes novos?

🖥️ Criamos *sites premium + chatbot inteligente* para advogados:
✅ Chatbot que atende e capta clientes 24h
✅ Blog jurídico com artigos da sua área
✅ Domínio .adv.br já incluso
✅ Suporte e garantia incluídos

Tudo isso por apenas *R$ 299/ano* 👇`,
    ],
    botoes: [
      { id: 'msg1_sim', texto: '✅ Quero conhecer' },
      { id: 'msg1_site', texto: '🌐 Já tenho site' },
      { id: 'msg1_nao', texto: '⏳ Agora não' },
    ],
    rodape: 'Toque em uma opção acima 👆',
  },

  // ─────────────────────────────────────────
  // MSG2 — Portfólio detalhado + proposta
  // ─────────────────────────────────────────
  msg2: {
    textos: [
      `Perfeito! 🎉

Veja um site que entregamos para um escritório de SP 👇

🔗 https://cerbeleraeoliveiraadv.vercel.app/

O *pacote completo* inclui:

🖥️ *Site Profissional* — design moderno, responsivo, com sua identidade visual
🤖 *Chatbot Inteligente* — atende 24h no site, coleta nome e WhatsApp e te envia o lead automaticamente
📝 *Blog Jurídico* — artigos otimizados para o Google sobre suas áreas de atuação
🔍 *SEO Local* — otimizado para buscas como "advogado trabalhista em [sua cidade]"
🔗 *Domínio .adv.br incluso* — registrado no nome do escritório
🛡️ *Infraestrutura robusta* — 100.000 acessos/mês, monitoramento contínuo
🛠️ *Suporte e garantia inclusos*`,

      `Tudo personalizado com logo, cores, nome dos sócios e áreas de atuação.

⚡ Entrega em *1 a 3 dias úteis* por apenas *R$ 299/ano*

👉 E o melhor: *vocês veem o site pronto antes de pagar!*

O que acha? 👇`,
    ],
    botoes: [
      { id: 'msg2_contratar', texto: '🔥 Quero contratar!' },
      { id: 'msg2_duvidas', texto: '❓ Tenho dúvidas' },
      { id: 'msg2_pensar', texto: '🤔 Vou pensar...' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  // ─────────────────────────────────────────
  // MSG2B — Qualificação (já tem site)
  // ─────────────────────────────────────────
  msg2b: {
    textos: [
      `Que ótimo que já se preocupam com presença online! 👏

Me conta: o site de vocês já tem tudo isso?

✅ Chatbot que atende e capta clientes 24h
✅ Blog jurídico com artigos otimizados pro Google
✅ SEO local (aparece nas buscas da sua cidade)
✅ Design responsivo (celular, tablet e PC)
✅ Domínio .adv.br registrado
✅ Suporte técnico e garantia de funcionamento`,
    ],
    botoes: [
      { id: 'msg2b_completo', texto: '💪 Tem tudo isso sim' },
      { id: 'msg2b_parcial', texto: '🔧 Tem algumas coisas' },
      { id: 'msg2b_naotem', texto: '👀 Não tem, me conta!' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  // ─────────────────────────────────────────
  // MSG2B_FIM — Já tem tudo (encerramento positivo)
  // ─────────────────────────────────────────
  msg2b_fim: {
    textos: [
      `Vocês estão bem preparados! 💪

Fico feliz em saber que já têm uma presença digital forte.

💡 Caso no futuro precisem de:
• Redesign mais moderno
• Chatbot mais inteligente
• Integrações com sistemas (CRM, agenda, pagamentos)
• Blog com estratégia de SEO

É só me chamar aqui mesmo! Terei prazer em ajudar. 🤝

Sucesso pro escritório! 🚀`,
    ],
    botoes: null,
    terminal: true,
  },

  // ─────────────────────────────────────────
  // MSG3A — Lead quente! (quer contratar)
  // ─────────────────────────────────────────
  msg3a: {
    textos: [
      `Excelente decisão! 🎉🔥

Nosso desenvolvedor vai entrar em contato *em breve* aqui mesmo para alinhar os detalhes.

Enquanto isso, já podem ir separando:

📎 *Logo do escritório* — preferencialmente PNG com fundo transparente
📸 *Fotos dos sócios* — pode ser do LinkedIn, fazemos tratamento profissional
🎨 *Identidade visual* — cores preferidas, estilo (sóbrio, moderno, arrojado)
📝 *Informações* — nome completo, áreas de atuação, endereço, WhatsApp e e-mail
🔗 *Domínio desejado* — ex: escritoriosilva.adv.br`,

      `Como funciona:

⚡ *1º* — Entregamos o site pronto pra aprovarem — *sem pagamento*
✅ *2º* — Vocês aprovam, aí confirmamos R$ 299/ano
🔗 *3º* — Vinculamos o domínio .adv.br (já incluso)

*Zero risco* — primeiro veem, depois pagam. 💪

Quanto mais detalhes trouxerem, mais rápido entregamos! 🚀

Como prefere prosseguir? 👇`,
    ],
    botoes: [
      { id: 'msg3a_enviar_docs', texto: '📤 Enviar documentos agora' },
      { id: 'msg3a_aguardar', texto: '⏳ Aguardar contato' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  // ─────────────────────────────────────────
  // MSG_COLETAR_NOME — Coleta nome do responsável para criar pedido
  // ─────────────────────────────────────────
  msg_coletar_nome: {
    textos: [
      `Perfeito! 🎉

Para criarmos seu pedido, preciso de uma informação rápida:

📝 *Qual o nome completo do responsável pelo escritório?*

Digite abaixo 👇`,
    ],
    botoes: null,
  },

  // ─────────────────────────────────────────
  // MSG_ENVIAR_DOCS — Redirecionar para o outro número
  // ─────────────────────────────────────────
  msg_enviar_docs: {
    textos: [
      `📤 *Documentos pendentes*

Envie os materiais para nosso número de atendimento:
👉 *18996311933*

Ao enviar, informe seu *código de pedido* e anexe:
📎 Logo do escritório
📸 Fotos dos sócios
📝 Nome, áreas de atuação, endereço
🎨 Cores e estilo preferidos
🔗 Domínio desejado (ex: escritoriosilva.adv.br)

Nosso desenvolvedor vai receber e iniciar o projeto! 🚀`,
    ],
    botoes: null,
    terminal: true,
  },

  // ─────────────────────────────────────────
  // MSG_AGUARDANDO — Contato prefere aguardar nosso retorno
  // ─────────────────────────────────────────
  msg_aguardando: {
    textos: [
      `⏳ *Interesse registrado!*

Seu pedido foi registrado e nosso desenvolvedor vai entrar em contato com você em breve.

Se mudar de ideia e quiser adiantar, envie os documentos para:
👉 *18996311933* informando seu *código de pedido*

Obrigado pela confiança! 🤝`,
    ],
    botoes: null,
    terminal: true,
  },

  // ─────────────────────────────────────────
  // MSG_FINALIZADO — Contato concluiu com interesse (marca interna)
  // ─────────────────────────────────────────
  msg_finalizado: {
    textos: [
      `✅ Tudo certo! Seu cadastro está confirmado.

Nosso desenvolvedor entrará em contato em breve para alinhar os detalhes do projeto.

Se precisar de algo antes, é só chamar! 😊🚀`,
    ],
    botoes: null,
    terminal: true,
  },

  // ─────────────────────────────────────────
  // MSG_DUVIDAS — Menu de dúvidas (substitui msg3b)
  // Triagem com opções específicas em vez de texto livre
  // ─────────────────────────────────────────
  msg_duvidas: {
    textos: [
      `Claro, vou te ajudar! 😊

Sobre qual assunto é sua dúvida? 👇`,
    ],
    botoes: [
      { id: 'duvida_precos', texto: '💰 Preços e prazos' },
      { id: 'duvida_incluso', texto: '📦 O que está incluso' },
      { id: 'duvida_processo', texto: '⚙️ Como funciona' },
    ],
    rodape: 'Escolha o tema da dúvida 👆',
  },

  // ─────────────────────────────────────────
  // MSG_PRECOS — Detalhes sobre preços e prazos
  // ─────────────────────────────────────────
  msg_precos: {
    textos: [
      `💰 *Preços e Prazos*

📌 *Pacote Site + Chatbot:* R$ 299/ano (menos de R$ 25/mês!)

O que está nesse valor:
• Site profissional completo
• Chatbot inteligente 24h
• Blog jurídico com artigos
• Domínio .adv.br registrado
• Hospedagem, SSL e suporte
• Monitoramento contínuo

⏰ *Prazo de entrega:* 1 a 3 dias úteis

💳 *Pagamento:* Só após aprovação do site pronto! Aceitamos PIX, cartão e boleto.

💡 Um único cliente captado pelo site já paga o investimento do ano inteiro — e sobra muito!

O que deseja fazer? 👇`,
    ],
    botoes: [
      { id: 'precos_contratar', texto: '🔥 Fechar agora!' },
      { id: 'precos_personalizado', texto: '🚀 Projeto personalizado' },
      { id: 'precos_duvidas', texto: '❓ Outras dúvidas' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  // ─────────────────────────────────────────
  // MSG_INCLUSO — O que está incluso no pacote
  // ─────────────────────────────────────────
  msg_incluso: {
    textos: [
      `📦 *O que está incluso no pacote*

🖥️ *Site Profissional:*
• Design moderno e personalizado
• Layout responsivo (celular, tablet, PC)
• Página sobre o escritório e equipe
• Áreas de atuação detalhadas
• Página de contato com formulário
• Mapa do Google integrado

🤖 *Chatbot Inteligente:*
• Aparece automaticamente no site
• Atende visitantes 24 horas
• Coleta nome, WhatsApp e assunto
• Envia os dados do lead direto pra você
• Personalizado com as cores do escritório

📝 *Blog Jurídico:*
• Artigos escritos por nós
• Otimizados para aparecer no Google
• Temas baseados nas suas áreas de atuação
• Atrai clientes sem pagar anúncio

🔗 *Extras inclusos:*
• Domínio .adv.br registrado
• Certificado SSL (cadeado verde)
• Hospedagem premium
• Suporte técnico
• Conformidade com OAB (Provimento 205/2021)

Tudo por *R$ 299/ano*! 👇`,
    ],
    botoes: [
      { id: 'incluso_contratar', texto: '🔥 Quero contratar!' },
      { id: 'incluso_personalizado', texto: '🚀 Projeto personalizado' },
      { id: 'incluso_duvidas', texto: '❓ Outras dúvidas' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  // ─────────────────────────────────────────
  // MSG_PROCESSO — Como funciona o processo
  // ─────────────────────────────────────────
  msg_processo: {
    textos: [
      `⚙️ *Como funciona o processo*

É muito simples e sem burocracia:

*1️⃣ Conversa inicial*
Você nos envia as informações do escritório (logo, fotos, áreas de atuação, cores).

*2️⃣ Criação do site (1-3 dias)*
Desenvolvemos tudo: site, chatbot, blog, SEO — personalizado pra vocês.

*3️⃣ Aprovação sem compromisso*
Vocês veem o site *pronto e funcionando* antes de qualquer pagamento.

*4️⃣ Pagamento só se aprovar*
Gostaram? Aí sim confirmamos R$ 299/ano (PIX, cartão ou boleto).

*5️⃣ Publicação*
Registramos o domínio .adv.br e publicamos. Site no ar! 🚀

*6️⃣ Suporte contínuo*
Monitoramos o site, corrigimos qualquer problema e vocês têm suporte direto.

✅ *Zero risco* — não gostou, não paga.

O que deseja fazer? 👇`,
    ],
    botoes: [
      { id: 'processo_contratar', texto: '🔥 Quero contratar!' },
      { id: 'processo_duvidas', texto: '❓ Outras dúvidas' },
      { id: 'processo_pensar', texto: '🤔 Vou pensar...' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  // ─────────────────────────────────────────
  // MSG_PERSONALIZADO — Projetos personalizados / Integrações
  // Para quem quer mais que o pacote base
  // ─────────────────────────────────────────
  msg_personalizado: {
    textos: [
      `🚀 *Projetos Personalizados*

Além do pacote base (site + chatbot), também desenvolvemos soluções sob medida:

🔧 *Integrações disponíveis:*
• CRM jurídico integrado ao site
• Agendamento online de consultas
• Sistema de pagamentos e honorários
• Painel administrativo personalizado
• Automações de WhatsApp avançadas

🏗️ *Sistemas completos:*
• Transformar o site num *ecossistema digital completo*
• Gestão de clientes, processos e prazos
• Portal do cliente com acompanhamento
• Dashboard com métricas do escritório

💰 Esses projetos têm *valores personalizados* de acordo com a complexidade e necessidade de cada escritório.

Como quer prosseguir? 👇`,
    ],
    botoes: [
      { id: 'pers_falar', texto: '💬 Falar com desenvolvedor' },
      { id: 'pers_base', texto: '🔥 Quero o pacote base' },
      { id: 'pers_pensar', texto: '🤔 Vou pensar...' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  // ─────────────────────────────────────────
  // MSG_HUMANO — Encaminhamento para o desenvolvedor
  // Último recurso — bot não consegue resolver
  // ─────────────────────────────────────────
  msg_humano: {
    textos: [
      `Perfeito! 💬

Vou encaminhar sua conversa para nosso desenvolvedor. Ele vai te responder *em breve* aqui mesmo neste chat.

📋 Ele poderá te ajudar com:
• Projetos personalizados e orçamentos
• Integrações específicas
• Qualquer dúvida técnica

⏰ Horário de atendimento: Seg-Sex, 8h às 18h

Enquanto isso, se quiser adiantar, pode já mandar detalhes do que precisa! 😊`,
    ],
    botoes: null,
    terminal: true,
  },

  // ─────────────────────────────────────────
  // MSG3C — Despedida / Não agora / Vou pensar
  // ─────────────────────────────────────────
  msg3c: {
    textos: [
      `Entendo, sem pressão nenhuma! 🤝

💡 Só deixo alguns fatos pra reflexão:

• Um único cliente captado pelo site já paga o *ano inteiro*
• O chatbot trabalha 24h captando leads *sem custo extra*
• O blog vai acumulando artigos e atraindo visitas do Google *automaticamente*
• Vocês veem o site *pronto antes de pagar* — zero risco

Se mudar de ideia, é só me mandar uma mensagem aqui que recomeçamos! 😊

Sucesso pro escritório! 🚀`,
    ],
    botoes: null,
    terminal: true,
  },

  // ─────────────────────────────────────────
  // FALLBACK — Resposta não reconhecida
  // ─────────────────────────────────────────
  fallback: {
    textos: [
      `Desculpe, não entendi sua resposta 😅

Por favor, toque em um dos botões abaixo para continuar:`,
    ],
    botoes: null,
    rodape: 'Toque em uma opção acima 👆',
  },
};

// ============================================
// MAPA DE TRANSIÇÕES — Qual botão leva para qual etapa
// ============================================
export interface Transicao {
  proximaEtapa: string;
  novoStatus: string | null;
  acao: string;
}

export const TRANSICOES: Record<string, Transicao> = {
  // msg1 → Saudação
  msg1_sim:       { proximaEtapa: 'msg2',     novoStatus: 'respondeu',         acao: 'enviar_msg2' },
  msg1_site:      { proximaEtapa: 'msg2b',    novoStatus: 'respondeu',         acao: 'enviar_msg2b' },
  msg1_nao:       { proximaEtapa: 'msg3c',    novoStatus: 'naoInteresse',      acao: 'enviar_msg3c' },

  // msg2 → Portfólio
  msg2_contratar:  { proximaEtapa: 'msg3a',        novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  msg2_duvidas:    { proximaEtapa: 'msg_duvidas',   novoStatus: 'respondeu',        acao: 'enviar_msg_duvidas' },
  msg2_pensar:     { proximaEtapa: 'msg3c',         novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },

  // msg3a → Coleta de nome (depois segue para envio docs ou aguardo)
  msg3a_enviar_docs: { proximaEtapa: 'msg_coletar_nome', novoStatus: 'aguardando_documentos', acao: 'coletar_nome' },
  msg3a_aguardar:    { proximaEtapa: 'msg_coletar_nome', novoStatus: 'aguardando_contato',    acao: 'coletar_nome' },

  // msg2b → Qualificação (já tem site)
  msg2b_completo: { proximaEtapa: 'msg2b_fim', novoStatus: 'naoInteresse',     acao: 'enviar_msg2b_fim' },
  msg2b_parcial:  { proximaEtapa: 'msg2',      novoStatus: 'respondeu',        acao: 'enviar_msg2' },
  msg2b_naotem:   { proximaEtapa: 'msg2',      novoStatus: 'respondeu',        acao: 'enviar_msg2' },

  // msg_duvidas → Menu de dúvidas
  duvida_precos:   { proximaEtapa: 'msg_precos',   novoStatus: 'respondeu', acao: 'enviar_msg_precos' },
  duvida_incluso:  { proximaEtapa: 'msg_incluso',  novoStatus: 'respondeu', acao: 'enviar_msg_incluso' },
  duvida_processo: { proximaEtapa: 'msg_processo',  novoStatus: 'respondeu', acao: 'enviar_msg_processo' },

  // msg_precos → Após ver preços
  precos_contratar:    { proximaEtapa: 'msg3a',             novoStatus: 'interessado', acao: 'enviar_msg3a_notificar' },
  precos_personalizado: { proximaEtapa: 'msg_personalizado', novoStatus: 'respondeu',  acao: 'enviar_msg_personalizado' },
  precos_duvidas:      { proximaEtapa: 'msg_duvidas',        novoStatus: 'respondeu',  acao: 'enviar_msg_duvidas' },

  // msg_incluso → Após ver o que inclui
  incluso_contratar:    { proximaEtapa: 'msg3a',             novoStatus: 'interessado', acao: 'enviar_msg3a_notificar' },
  incluso_personalizado: { proximaEtapa: 'msg_personalizado', novoStatus: 'respondeu',  acao: 'enviar_msg_personalizado' },
  incluso_duvidas:      { proximaEtapa: 'msg_duvidas',        novoStatus: 'respondeu',  acao: 'enviar_msg_duvidas' },

  // msg_processo → Após ver como funciona
  processo_contratar: { proximaEtapa: 'msg3a',       novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  processo_duvidas:   { proximaEtapa: 'msg_duvidas',  novoStatus: 'respondeu',        acao: 'enviar_msg_duvidas' },
  processo_pensar:    { proximaEtapa: 'msg3c',        novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },

  // msg_personalizado → Projetos personalizados
  pers_falar:  { proximaEtapa: 'msg_humano', novoStatus: 'interessado',       acao: 'enviar_msg_humano_notificar' },
  pers_base:   { proximaEtapa: 'msg3a',      novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  pers_pensar: { proximaEtapa: 'msg3c',      novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
};

// ============================================
// MAPA NUMÉRICO LEGADO — lead digita "1", "2", "3"
// ============================================
export const MAPA_NUMERICO: Record<string, Record<number, string>> = {
  inicio:            { 1: 'msg1_sim',           2: 'msg1_site',          3: 'msg1_nao' },
  msg1:              { 1: 'msg1_sim',           2: 'msg1_site',          3: 'msg1_nao' },
  msg2:              { 1: 'msg2_contratar',     2: 'msg2_duvidas',       3: 'msg2_pensar' },
  msg2b:             { 1: 'msg2b_completo',     2: 'msg2b_parcial',      3: 'msg2b_naotem' },
  msg3a:             { 1: 'msg3a_enviar_docs',  2: 'msg3a_aguardar' },
  msg_duvidas:       { 1: 'duvida_precos',      2: 'duvida_incluso',     3: 'duvida_processo' },
  msg_precos:        { 1: 'precos_contratar',   2: 'precos_personalizado', 3: 'precos_duvidas' },
  msg_incluso:       { 1: 'incluso_contratar',  2: 'incluso_personalizado', 3: 'incluso_duvidas' },
  msg_processo:      { 1: 'processo_contratar', 2: 'processo_duvidas',   3: 'processo_pensar' },
  msg_personalizado: { 1: 'pers_falar',         2: 'pers_base',          3: 'pers_pensar' },
};

// ============================================
// COMPATIBILIDADE — MENSAGENS e BOTOES antigos
// ============================================
export const MENSAGENS: Record<string, string> = {};
export const BOTOES: Record<string, any[]> = {};

for (const [etapa, fluxo] of Object.entries(FLUXO)) {
  if (etapa === 'fallback') continue;
  MENSAGENS[etapa] = fluxo.textos.join('\n\n');
  if (fluxo.botoes) {
    BOTOES[etapa] = fluxo.botoes.map(b => ({
      id: b.id,
      texto: b.texto,
      descricao: b.descricao || '',
    }));
  }
}

// ============================================
// HELPER — Gerar mensagem de fallback com botões da etapa atual
// ============================================
export function gerarFallback(etapaAtual: string): { texto: string; botoes: BotaoInterativo[] | null } {
  const etapa = FLUXO[etapaAtual];
  if (!etapa || !etapa.botoes) {
    return { texto: 'Desculpe, não entendi. Pode tocar em um botão acima ou me enviar outra mensagem! 😊', botoes: null };
  }
  return {
    texto: FLUXO.fallback.textos[0],
    botoes: etapa.botoes,
  };
}

// Manter export antigo
export function gerarMensagemOpcaoInvalida(etapa: string): string | null {
  const fb = gerarFallback(etapa);
  if (!fb.botoes) return null;
  const opcoes = fb.botoes.map(b => b.texto).join('\n');
  return `${fb.texto}\n\n${opcoes}`;
}
