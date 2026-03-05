// ============================================
// Mensagens do Bot — Templates centralizados
// REESTRUTURADO: Todas as etapas usam botões nativos WPPConnect
// Mensagens longas divididas: conteúdo + menu separado
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
  /** Se true, esta é uma etapa terminal (sem continuidade automática) */
  terminal?: boolean;
}

export interface BotaoInterativo {
  id: string;
  texto: string;
  descricao?: string;
}

// ============================================
// FLUXO COMPLETO — Cada etapa com conteúdo + botões
// ============================================
export const FLUXO: Record<string, EtapaFluxo> = {

  // ─────────────────────────────────────────
  // INICIO — Alias de msg1 (default do Prisma)
  // Contatos novos têm etapaBot='inicio'
  // ─────────────────────────────────────────
  inicio: {
    textos: [
      `Olá! 👋 Tudo bem?

Você sabia que escritórios de advocacia com site profissional recebem até *3x mais contatos* de clientes novos?

🖥️ Criamos sites premium para advogados com:
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
  // MSG1 — Saudação inicial (prospecção fria)
  // ─────────────────────────────────────────
  msg1: {
    textos: [
      `Olá! 👋 Tudo bem?

Você sabia que escritórios de advocacia com site profissional recebem até *3x mais contatos* de clientes novos?

🖥️ Criamos sites premium para advogados com:
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
  // MSG2 — Portfólio + proposta
  // Dividida: texto detalhado → menu com botões
  // ─────────────────────────────────────────
  msg2: {
    textos: [
      `Perfeito! 🎉

Aqui está um site que entregamos para um escritório de SP 👇

🔗 https://cerbeleraeoliveiraadv.vercel.app/

Veja o que está *incluso*:

🤖 *Chatbot Inteligente* — Fica no site 24h. Quando um cliente entra, o chatbot inicia a conversa, coleta nome e WhatsApp e te envia o contato direto.

📝 *Blog Jurídico* — Artigos sobre o que seus clientes pesquisam no Google. Atrai visitas orgânicas sem pagar anúncio.

🔍 *SEO Local* — Site otimizado para buscas como "advogado trabalhista em [sua cidade]".

📱 *Design Responsivo* — Funciona no celular, tablet e PC.

🔗 *Domínio .adv.br incluso* — Registrado no nome do escritório.

🛡️ *Infraestrutura robusta* — Aguenta 100.000 acessos/mês sem travar.

🛠️ *Suporte e garantia inclusos*.`,

      `Tudo personalizado com logo, cores, nome dos sócios e áreas de atuação.

⚡ Entrega em *1 a 3 dias úteis* por apenas *R$ 299/ano*

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

Me conta: o site de vocês tem essas funcionalidades?

✅ Chatbot que responde clientes 24h
✅ Blog jurídico com artigos da área
✅ Otimização para o Google (SEO)
✅ Design responsivo no celular
✅ Domínio .adv.br registrado
✅ Suporte e garantia de funcionamento`,
    ],
    botoes: [
      { id: 'msg2b_completo', texto: '💪 Tem tudo isso sim' },
      { id: 'msg2b_parcial', texto: '🔧 Tem algumas coisas' },
      { id: 'msg2b_naotem', texto: '👀 Não tem, me conta!' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  // ─────────────────────────────────────────
  // MSG2B_FIM — Encerramento positivo (já tem tudo)
  // ─────────────────────────────────────────
  msg2b_fim: {
    textos: [
      `Uau, vocês estão bem preparados! 💪

Fico feliz em saber que já têm uma presença digital forte.

Só quero deixar meu contato caso precisem de alguma melhoria futura ou queiram renovar o site com um design mais moderno.

Qualquer coisa, pode me chamar. Sucesso pra vocês! 🤝`,
    ],
    botoes: null,
    terminal: true,
  },

  // ─────────────────────────────────────────
  // MSG3A — Lead quente! (quer contratar)
  // ─────────────────────────────────────────
  msg3a: {
    textos: [
      `Ótimo, que bom que toparam! 🎉

Em breve nosso desenvolvedor vai entrar em contato aqui mesmo.

Enquanto isso, já vão separando:

📎 *Logo do escritório* — preferencialmente PNG com fundo transparente
📸 *Fotos dos sócios* — pode ser do LinkedIn ou qualquer uma, fazemos tratamento profissional
🎨 *Identidade visual* — cores preferidas, estilo (sóbrio, moderno, arrojado)
📝 *Informações* — nome completo, áreas de atuação, endereço, WhatsApp e e-mail
🔗 *Domínio desejado* — ex: escritoriosilva.adv.br`,

      `Como funciona nossa entrega:

⚡ *1º* — Entregamos o site pronto pra vocês aprovarem, sem pagamento ainda
✅ *2º* — Vocês aprovam, aí confirmamos o pagamento de R$ 299/ano
🔗 *3º* — Vinculamos o domínio .adv.br, já incluso no valor

*Zero risco* — primeiro veem, depois pagam. 💪

Quanto mais detalhes trouxerem, mais rápido entregamos! 🚀`,
    ],
    botoes: null,
    terminal: true,
  },

  // ─────────────────────────────────────────
  // MSG3B — FAQ / Dúvidas
  // ─────────────────────────────────────────
  msg3b: {
    textos: [
      `Claro! Me pergunta à vontade 😊

As dúvidas mais comuns:

🤖 *Chatbot funciona como?*
Aparece no site 24h, inicia conversa, coleta nome e WhatsApp e te envia o contato.

📝 *Quem escreve os artigos?*
A gente cria! Com base nas suas áreas, artigos que atraem visitas do Google.

🔗 *Domínio incluso mesmo?*
Sim! .com.br ou .adv.br incluso nos R$ 299/ano, registrado no nome do escritório.

💳 *Preciso pagar antes?*
Não! Entregamos o site funcionando pra aprovarem primeiro.

🛡️ *Pode cair?*
Não. Suporta 100.000 acessos/mês e monitoramos continuamente.

⚖️ *Dentro das normas da OAB?*
Sim! Provimento 205/2021 respeitado.`,
    ],
    botoes: [
      { id: 'msg3b_contratar', texto: '🔥 Quero contratar!' },
      { id: 'msg3b_duvidas', texto: '❓ Mais dúvidas' },
      { id: 'msg3b_pensar', texto: '🤔 Vou pensar...' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  // ─────────────────────────────────────────
  // MSG3B_REPEAT — Repetição FAQ (2ª vez)
  // ─────────────────────────────────────────
  msg3b_repeat: {
    textos: [
      `Sem problema! 😊

Se tiver qualquer dúvida específica, pode digitar aqui que eu respondo.

Mas se já se decidiu, é só tocar no botão 👇`,
    ],
    botoes: [
      { id: 'msg3br_contratar', texto: '🔥 Quero contratar!' },
      { id: 'msg3br_pensar', texto: '🤔 Vou pensar...' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  // ─────────────────────────────────────────
  // MSG3C — Follow-up / Não agora
  // ─────────────────────────────────────────
  msg3c: {
    textos: [
      `Entendo, sem pressão! 🤝

💡 Um único cliente captado pelo site já paga o ano inteiro — e sobra muito.

👉 *Vocês veem o site pronto antes de pagar.* Só confirmam o pagamento após aprovar.

O blog jurídico vai acumulando artigos com o tempo — quanto mais tempo online, mais o site aparece no Google e mais clientes chegam automaticamente.

*Zero risco.* Vocês só pagam se gostarem. 😊

Se quiser, posso te mandar uma prévia gratuita com o nome do escritório. Sem compromisso. 🎨

Quando quiser, é só me chamar!`,
    ],
    botoes: null,
    terminal: true,
  },

  // ─────────────────────────────────────────
  // FALLBACK — Mensagem para resposta não reconhecida
  // ─────────────────────────────────────────
  fallback: {
    textos: [
      `Desculpe, não entendi sua resposta 😅

Por favor, toque em um dos botões abaixo para continuar:`,
    ],
    botoes: null, // Preenchido dinamicamente com os botões da etapa atual
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
  msg2_contratar: { proximaEtapa: 'msg3a',    novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  msg2_duvidas:   { proximaEtapa: 'msg3b',    novoStatus: 'respondeu',         acao: 'enviar_msg3b' },
  msg2_pensar:    { proximaEtapa: 'msg3c',    novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },

  // msg2b → Qualificação
  msg2b_completo: { proximaEtapa: 'msg2b_fim', novoStatus: 'naoInteresse',     acao: 'enviar_msg2b_fim' },
  msg2b_parcial:  { proximaEtapa: 'msg2',      novoStatus: 'respondeu',        acao: 'enviar_msg2' },
  msg2b_naotem:   { proximaEtapa: 'msg2',      novoStatus: 'respondeu',        acao: 'enviar_msg2' },

  // msg3b → FAQ
  msg3b_contratar: { proximaEtapa: 'msg3a',        novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  msg3b_duvidas:   { proximaEtapa: 'msg3b_repeat',  novoStatus: 'respondeu',        acao: 'enviar_msg3b_repeat' },
  msg3b_pensar:    { proximaEtapa: 'msg3c',         novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },

  // msg3b_repeat → FAQ 2ª vez
  msg3br_contratar: { proximaEtapa: 'msg3a', novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  msg3br_pensar:    { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
};

// ============================================
// MAPA NUMÉRICO LEGADO — Quando botões falham ou lead digita "1", "2", "3"
// Mapeia etapa + número → buttonId equivalente
// ============================================
export const MAPA_NUMERICO: Record<string, Record<number, string>> = {
  inicio:       { 1: 'msg1_sim',       2: 'msg1_site',      3: 'msg1_nao' },
  msg1:         { 1: 'msg1_sim',       2: 'msg1_site',      3: 'msg1_nao' },
  msg2:         { 1: 'msg2_contratar', 2: 'msg2_duvidas',   3: 'msg2_pensar' },
  msg2b:        { 1: 'msg2b_completo', 2: 'msg2b_parcial',  3: 'msg2b_naotem' },
  msg3b:        { 1: 'msg3b_contratar', 2: 'msg3b_duvidas', 3: 'msg3b_pensar' },
  msg3b_repeat: { 1: 'msg3br_contratar', 2: 'msg3br_pensar', 3: 'msg3br_pensar' },
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
    return { texto: 'Desculpe, não entendi. Um atendente vai te ajudar em breve! 😊', botoes: null };
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
