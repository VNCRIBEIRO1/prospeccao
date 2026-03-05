// ============================================
// Detecção de Resposta — Motor de decisão do Bot (Backend)
// REESTRUTURADO: Usa TRANSICOES por buttonId nomeado
// Espelho de frontend/lib/detector.ts
// ============================================
const logger = require('./logger');

// ════════════════════════════════════════
// MAPA DE TRANSIÇÕES — Qual botão leva para qual etapa
// ════════════════════════════════════════
const TRANSICOES = {
  // msg1
  msg1_sim:       { proximaEtapa: 'msg2',     novoStatus: 'respondeu',         acao: 'enviar_msg2' },
  msg1_site:      { proximaEtapa: 'msg2b',    novoStatus: 'respondeu',         acao: 'enviar_msg2b' },
  msg1_nao:       { proximaEtapa: 'msg3c',    novoStatus: 'naoInteresse',      acao: 'enviar_msg3c' },
  // msg2
  msg2_contratar: { proximaEtapa: 'msg3a',    novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  msg2_duvidas:   { proximaEtapa: 'msg3b',    novoStatus: 'respondeu',         acao: 'enviar_msg3b' },
  msg2_pensar:    { proximaEtapa: 'msg3c',    novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
  // msg2b
  msg2b_completo: { proximaEtapa: 'msg2b_fim', novoStatus: 'naoInteresse',     acao: 'enviar_msg2b_fim' },
  msg2b_parcial:  { proximaEtapa: 'msg2',      novoStatus: 'respondeu',        acao: 'enviar_msg2' },
  msg2b_naotem:   { proximaEtapa: 'msg2',      novoStatus: 'respondeu',        acao: 'enviar_msg2' },
  // msg3b
  msg3b_contratar: { proximaEtapa: 'msg3a',        novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  msg3b_duvidas:   { proximaEtapa: 'msg3b_repeat',  novoStatus: 'respondeu',        acao: 'enviar_msg3b_repeat' },
  msg3b_pensar:    { proximaEtapa: 'msg3c',         novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
  // msg3b_repeat
  msg3br_contratar: { proximaEtapa: 'msg3a', novoStatus: 'interessado',       acao: 'enviar_msg3a_notificar' },
  msg3br_pensar:    { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
};

// ════════════════════════════════════════
// MAPA NUMÉRICO — Quando botões falham ou lead digita "1", "2", "3"
// ════════════════════════════════════════
const MAPA_NUMERICO = {
  inicio:       { 1: 'msg1_sim',       2: 'msg1_site',      3: 'msg1_nao' },
  msg1:         { 1: 'msg1_sim',       2: 'msg1_site',      3: 'msg1_nao' },
  msg2:         { 1: 'msg2_contratar', 2: 'msg2_duvidas',   3: 'msg2_pensar' },
  msg2b:        { 1: 'msg2b_completo', 2: 'msg2b_parcial',  3: 'msg2b_naotem' },
  msg3b:        { 1: 'msg3b_contratar', 2: 'msg3b_duvidas', 3: 'msg3b_pensar' },
  msg3b_repeat: { 1: 'msg3br_contratar', 2: 'msg3br_pensar', 3: 'msg3br_pensar' },
};

// Botões por etapa (para match por texto)
const BOTOES_ETAPA = {
  msg1:         [{ id: 'msg1_sim', texto: 'quero conhecer' }, { id: 'msg1_site', texto: 'ja tenho site' }, { id: 'msg1_nao', texto: 'agora nao' }],
  msg2:         [{ id: 'msg2_contratar', texto: 'quero contratar' }, { id: 'msg2_duvidas', texto: 'tenho duvidas' }, { id: 'msg2_pensar', texto: 'vou pensar' }],
  msg2b:        [{ id: 'msg2b_completo', texto: 'tem tudo isso sim' }, { id: 'msg2b_parcial', texto: 'tem algumas coisas' }, { id: 'msg2b_naotem', texto: 'nao tem me conta' }],
  msg3b:        [{ id: 'msg3b_contratar', texto: 'quero contratar' }, { id: 'msg3b_duvidas', texto: 'mais duvidas' }, { id: 'msg3b_pensar', texto: 'vou pensar' }],
  msg3b_repeat: [{ id: 'msg3br_contratar', texto: 'quero contratar' }, { id: 'msg3br_pensar', texto: 'vou pensar' }],
};

const ETAPAS_TERMINAIS = ['msg3a', 'msg3c', 'msg2b_fim', 'atendimento_manual', 'bloqueado'];

const REGEX_BLOQUEIO = /\b(parar|pare|bloquear|spam|denuncia|denunciar|sair|remover|cancelar|nao me mande|pare de|nao quero mais|me tire|me remove|stop)\b/;
const PALAVRAS_OPCAO_1 = /\b(sim|quero|contratar|conhecer|aceito|bora|vamos|claro|com certeza|fechado|fechar|vamo|manda|pode|show|top|boa|massa|legal|interesse|interessado)\b/;
const PALAVRAS_OPCAO_2 = /\b(tenho site|ja tenho|duvida|pergunta|algumas|como funciona|explica|informacoes|saber mais|me conta|fala mais|parcial|algumas coisas)\b/;
const PALAVRAS_OPCAO_3 = /\b(agora nao|pensar|depois|nao|talvez|mais tarde|nao quero|obrigado|valeu|sem interesse|nao preciso|vou pensar|nao agora)\b/;

/**
 * Resolve um número para buttonId via MAPA_NUMERICO
 */
function resolverPorNumero(numero, etapaAtual) {
  const mapa = MAPA_NUMERICO[etapaAtual];
  if (!mapa) return null;
  const buttonId = mapa[numero];
  if (!buttonId) return null;
  const transicao = TRANSICOES[buttonId];
  if (!transicao) return null;
  return { ...transicao, buttonId };
}

/**
 * Detecta a intenção do usuário e retorna a próxima etapa.
 *
 * Prioridade: buttonId nativo → bloqueio → número → texto botão → semântica → fallback
 */
function detectarResposta(texto, etapaAtual, buttonId) {
  const t = (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // 1) BOTÃO NATIVO
  if (buttonId) {
    const transicao = TRANSICOES[buttonId];
    if (transicao) {
      logger.info('Botão nativo detectado', { buttonId, proximaEtapa: transicao.proximaEtapa });
      return { ...transicao, buttonId };
    }
    // Legado (opt_1, opt_2, opt_3)
    const opcaoLegada = buttonId === 'opt_1' ? 1 : buttonId === 'opt_2' ? 2 : buttonId === 'opt_3' ? 3 : 0;
    if (opcaoLegada > 0) {
      const resolved = resolverPorNumero(opcaoLegada, etapaAtual);
      if (resolved) return resolved;
    }
  }

  // 2) BLOQUEIO
  if (REGEX_BLOQUEIO.test(t)) {
    logger.info('Bloqueio detectado', { texto: t.substring(0, 30) });
    return { proximaEtapa: 'bloqueado', novoStatus: 'naoInteresse', acao: 'bloquear' };
  }

  // 3) NÚMERO DIGITADO
  const limpo = t.replace(/[\ufe0f\u20e3]/g, '');
  const matchNumero = limpo.match(/^[^\d]*([1-3])[^\d]*$/);
  if (matchNumero) {
    const num = parseInt(matchNumero[1]);
    const resolved = resolverPorNumero(num, etapaAtual);
    if (resolved) {
      logger.info('Número digitado', { numero: num, proximaEtapa: resolved.proximaEtapa });
      return resolved;
    }
  }

  // Emoji números
  if (/1\ufe0f?\u20e3/.test(texto)) { const r = resolverPorNumero(1, etapaAtual); if (r) return r; }
  if (/2\ufe0f?\u20e3/.test(texto)) { const r = resolverPorNumero(2, etapaAtual); if (r) return r; }
  if (/3\ufe0f?\u20e3/.test(texto)) { const r = resolverPorNumero(3, etapaAtual); if (r) return r; }

  // 4) TEXTO DO BOTÃO — match parcial
  const botoesEtapa = BOTOES_ETAPA[etapaAtual];
  if (botoesEtapa) {
    for (const botao of botoesEtapa) {
      const palavras = botao.texto.split(/\s+/).filter(p => p.length > 2);
      const matchCount = palavras.filter(p => t.includes(p)).length;
      if (matchCount >= 2 || (palavras.length <= 2 && matchCount >= 1 && t.length < 30)) {
        const transicao = TRANSICOES[botao.id];
        if (transicao) {
          logger.info('Match texto botão', { texto: t.substring(0, 30), buttonId: botao.id });
          return { ...transicao, buttonId: botao.id };
        }
      }
    }
  }

  // 5) SEMÂNTICA
  const m1 = PALAVRAS_OPCAO_1.test(t);
  const m2 = PALAVRAS_OPCAO_2.test(t);
  const m3 = PALAVRAS_OPCAO_3.test(t);

  if (m1 && !m3) { const r = resolverPorNumero(1, etapaAtual); if (r) return r; }
  if (m2 && !m1 && !m3) { const r = resolverPorNumero(2, etapaAtual); if (r) return r; }
  if (m3 && !m1) { const r = resolverPorNumero(3, etapaAtual); if (r) return r; }

  // 6) FALLBACK
  if (ETAPAS_TERMINAIS.includes(etapaAtual)) {
    return { proximaEtapa: 'atendimento_manual', novoStatus: null, acao: 'manual' };
  }

  logger.info('Resposta não reconhecida', { texto: t.substring(0, 40), etapaAtual });
  return { proximaEtapa: etapaAtual, novoStatus: null, acao: 'reenviar_opcoes' };
}

module.exports = { detectarResposta };
