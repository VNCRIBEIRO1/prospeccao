// ============================================
// Mensagens do Bot — Templates centralizados (Backend)
// REESTRUTURADO: Espelho de frontend/lib/mensagens.ts
// ============================================

// ============================================
// FLUXO COMPLETO — Cada etapa com conteúdo + botões
// ============================================
const FLUXO = {
  msg1: {
    textos: [
      `Olá! 👋 Tudo bem?\n\nVocê sabia que escritórios de advocacia com site profissional recebem até *3x mais contatos* de clientes novos?\n\n🖥️ Criamos sites premium para advogados com:\n✅ Chatbot que atende e capta clientes 24h\n✅ Blog jurídico com artigos da sua área\n✅ Domínio .adv.br já incluso\n✅ Suporte e garantia incluídos\n\nTudo isso por apenas *R$ 299/ano* 👇`,
    ],
    botoes: [
      { id: 'msg1_sim', texto: '✅ Quero conhecer' },
      { id: 'msg1_site', texto: '🌐 Já tenho site' },
      { id: 'msg1_nao', texto: '⏳ Agora não' },
    ],
    rodape: 'Toque em uma opção acima 👆',
  },

  msg2: {
    textos: [
      `Perfeito! 🎉\n\nAqui está um site que entregamos para um escritório de SP 👇\n\n🔗 https://cerbeleraeoliveiraadv.vercel.app/\n\nVeja o que está *incluso*:\n\n🤖 *Chatbot Inteligente* — Fica no site 24h. Quando um cliente entra, o chatbot inicia a conversa, coleta nome e WhatsApp e te envia o contato direto.\n\n📝 *Blog Jurídico* — Artigos sobre o que seus clientes pesquisam no Google. Atrai visitas orgânicas sem pagar anúncio.\n\n🔍 *SEO Local* — Site otimizado para buscas como "advogado trabalhista em [sua cidade]".\n\n📱 *Design Responsivo* — Funciona no celular, tablet e PC.\n\n🔗 *Domínio .adv.br incluso* — Registrado no nome do escritório.\n\n🛡️ *Infraestrutura robusta* — Aguenta 100.000 acessos/mês sem travar.\n\n🛠️ *Suporte e garantia inclusos*.`,
      `Tudo personalizado com logo, cores, nome dos sócios e áreas de atuação.\n\n⚡ Entrega em *1 a 3 dias úteis* por apenas *R$ 299/ano*\n\nO que acha? 👇`,
    ],
    botoes: [
      { id: 'msg2_contratar', texto: '🔥 Quero contratar!' },
      { id: 'msg2_duvidas', texto: '❓ Tenho dúvidas' },
      { id: 'msg2_pensar', texto: '🤔 Vou pensar...' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  msg2b: {
    textos: [
      `Que ótimo que já se preocupam com presença online! 👏\n\nMe conta: o site de vocês tem essas funcionalidades?\n\n✅ Chatbot que responde clientes 24h\n✅ Blog jurídico com artigos da área\n✅ Otimização para o Google (SEO)\n✅ Design responsivo no celular\n✅ Domínio .adv.br registrado\n✅ Suporte e garantia de funcionamento`,
    ],
    botoes: [
      { id: 'msg2b_completo', texto: '💪 Tem tudo isso sim' },
      { id: 'msg2b_parcial', texto: '🔧 Tem algumas coisas' },
      { id: 'msg2b_naotem', texto: '👀 Não tem, me conta!' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  msg2b_fim: {
    textos: [
      `Uau, vocês estão bem preparados! 💪\n\nFico feliz em saber que já têm uma presença digital forte.\n\nSó quero deixar meu contato caso precisem de alguma melhoria futura ou queiram renovar o site com um design mais moderno.\n\nQualquer coisa, pode me chamar. Sucesso pra vocês! 🤝`,
    ],
    botoes: null,
    terminal: true,
  },

  msg3a: {
    textos: [
      `Ótimo, que bom que toparam! 🎉\n\nEm breve nosso desenvolvedor vai entrar em contato aqui mesmo.\n\nEnquanto isso, já vão separando:\n\n📎 *Logo do escritório* — preferencialmente PNG com fundo transparente\n📸 *Fotos dos sócios* — pode ser do LinkedIn ou qualquer uma, fazemos tratamento profissional\n🎨 *Identidade visual* — cores preferidas, estilo (sóbrio, moderno, arrojado)\n📝 *Informações* — nome completo, áreas de atuação, endereço, WhatsApp e e-mail\n🔗 *Domínio desejado* — ex: escritoriosilva.adv.br`,
      `Como funciona nossa entrega:\n\n⚡ *1º* — Entregamos o site pronto pra vocês aprovarem, sem pagamento ainda\n✅ *2º* — Vocês aprovam, aí confirmamos o pagamento de R$ 299/ano\n🔗 *3º* — Vinculamos o domínio .adv.br, já incluso no valor\n\n*Zero risco* — primeiro veem, depois pagam. 💪\n\nQuanto mais detalhes trouxerem, mais rápido entregamos! 🚀`,
    ],
    botoes: null,
    terminal: true,
  },

  msg3b: {
    textos: [
      `Claro! Me pergunta à vontade 😊\n\nAs dúvidas mais comuns:\n\n🤖 *Chatbot funciona como?*\nAparece no site 24h, inicia conversa, coleta nome e WhatsApp e te envia o contato.\n\n📝 *Quem escreve os artigos?*\nA gente cria! Com base nas suas áreas, artigos que atraem visitas do Google.\n\n🔗 *Domínio incluso mesmo?*\nSim! .com.br ou .adv.br incluso nos R$ 299/ano, registrado no nome do escritório.\n\n💳 *Preciso pagar antes?*\nNão! Entregamos o site funcionando pra aprovarem primeiro.\n\n🛡️ *Pode cair?*\nNão. Suporta 100.000 acessos/mês e monitoramos continuamente.\n\n⚖️ *Dentro das normas da OAB?*\nSim! Provimento 205/2021 respeitado.`,
    ],
    botoes: [
      { id: 'msg3b_contratar', texto: '🔥 Quero contratar!' },
      { id: 'msg3b_duvidas', texto: '❓ Mais dúvidas' },
      { id: 'msg3b_pensar', texto: '🤔 Vou pensar...' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  msg3b_repeat: {
    textos: [
      `Sem problema! 😊\n\nSe tiver qualquer dúvida específica, pode digitar aqui que eu respondo.\n\nMas se já se decidiu, é só tocar no botão 👇`,
    ],
    botoes: [
      { id: 'msg3br_contratar', texto: '🔥 Quero contratar!' },
      { id: 'msg3br_pensar', texto: '🤔 Vou pensar...' },
    ],
    rodape: 'Escolha uma opção 👆',
  },

  msg3c: {
    textos: [
      `Entendo, sem pressão! 🤝\n\n💡 Um único cliente captado pelo site já paga o ano inteiro — e sobra muito.\n\n👉 *Vocês veem o site pronto antes de pagar.* Só confirmam o pagamento após aprovar.\n\nO blog jurídico vai acumulando artigos com o tempo — quanto mais tempo online, mais o site aparece no Google e mais clientes chegam automaticamente.\n\n*Zero risco.* Vocês só pagam se gostarem. 😊\n\nSe quiser, posso te mandar uma prévia gratuita com o nome do escritório. Sem compromisso. 🎨\n\nQuando quiser, é só me chamar!`,
    ],
    botoes: null,
    terminal: true,
  },
};

// ============================================
// TRANSIÇÕES
// ============================================
const TRANSICOES = {
  msg1_sim:       { proximaEtapa: 'msg2',     novoStatus: 'respondeu',         acao: 'enviar_msg2' },
  msg1_site:      { proximaEtapa: 'msg2b',    novoStatus: 'respondeu',         acao: 'enviar_msg2b' },
  msg1_nao:       { proximaEtapa: 'msg3c',    novoStatus: 'naoInteresse',      acao: 'enviar_msg3c' },
  msg2_contratar: { proximaEtapa: 'msg3a',    novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  msg2_duvidas:   { proximaEtapa: 'msg3b',    novoStatus: 'respondeu',         acao: 'enviar_msg3b' },
  msg2_pensar:    { proximaEtapa: 'msg3c',    novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
  msg2b_completo: { proximaEtapa: 'msg2b_fim', novoStatus: 'naoInteresse',     acao: 'enviar_msg2b_fim' },
  msg2b_parcial:  { proximaEtapa: 'msg2',      novoStatus: 'respondeu',        acao: 'enviar_msg2' },
  msg2b_naotem:   { proximaEtapa: 'msg2',      novoStatus: 'respondeu',        acao: 'enviar_msg2' },
  msg3b_contratar: { proximaEtapa: 'msg3a',        novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  msg3b_duvidas:   { proximaEtapa: 'msg3b_repeat',  novoStatus: 'respondeu',        acao: 'enviar_msg3b_repeat' },
  msg3b_pensar:    { proximaEtapa: 'msg3c',         novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
  msg3br_contratar: { proximaEtapa: 'msg3a', novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  msg3br_pensar:    { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
};

// ============================================
// COMPATIBILIDADE — Exports MENSAGENS e BOTOES antigos
// ============================================
const MENSAGENS = {};
const BOTOES = {};

for (const [etapa, fluxo] of Object.entries(FLUXO)) {
  MENSAGENS[etapa] = fluxo.textos.join('\n\n');
  if (fluxo.botoes) {
    BOTOES[etapa] = fluxo.botoes.map(b => ({
      id: b.id,
      texto: b.texto,
      descricao: b.descricao || '',
    }));
  }
}

function gerarMensagemOpcaoInvalida(etapa) {
  const fluxo = FLUXO[etapa];
  if (!fluxo || !fluxo.botoes) return null;
  const opcoes = fluxo.botoes.map(b => b.texto).join('\n');
  return `Desculpe, não entendi sua resposta 😅\n\nPor favor, toque em um dos botões abaixo para continuar:\n\n${opcoes}`;
}

function gerarFallback(etapaAtual) {
  const etapa = FLUXO[etapaAtual];
  if (!etapa || !etapa.botoes) {
    return { texto: 'Desculpe, não entendi. Um atendente vai te ajudar em breve! 😊', botoes: null };
  }
  return {
    texto: 'Desculpe, não entendi sua resposta 😅\n\nPor favor, toque em um dos botões abaixo para continuar:',
    botoes: etapa.botoes,
  };
}

module.exports = MENSAGENS;
module.exports.MENSAGENS = MENSAGENS;
module.exports.BOTOES = BOTOES;
module.exports.FLUXO = FLUXO;
module.exports.TRANSICOES = TRANSICOES;
module.exports.gerarMensagemOpcaoInvalida = gerarMensagemOpcaoInvalida;
module.exports.gerarFallback = gerarFallback;
