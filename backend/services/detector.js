// ============================================
// Detecção de Resposta — Motor de decisão do Bot
// Suporta: texto livre, botões interativos, listas
// ============================================
const logger = require('./logger');

/**
 * Detecta a intenção do usuário com base no texto e na etapa atual do fluxo.
 * @param {string} texto - Texto digitado ou botão clicado
 * @param {string} etapaAtual - Etapa atual do bot
 * @param {string|null} buttonId - ID do botão clicado (opt_1, opt_2, opt_3) ou null
 * @returns {object} { proximaEtapa, novoStatus, acao }
 */
function detectarResposta(texto, etapaAtual, buttonId) {
  const t = (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // ============================================
  // 1) BOTÃO CLICADO — resposta exata e confiável
  // ============================================
  if (buttonId) {
    const opcao = buttonId === 'opt_1' ? 1 : buttonId === 'opt_2' ? 2 : buttonId === 'opt_3' ? 3 : 0;
    if (opcao > 0) {
      return resolverOpcao(opcao, etapaAtual);
    }
  }

  // ============================================
  // 2) BLOQUEIO — parar bot imediatamente
  // ============================================
  const bloqueio = /\b(parar|pare|bloquear|spam|denuncia|denunciar|sair|remover|cancelar|nao me mande|pare de|nao quero mais|me tire|me remove)\b/.test(t);
  if (bloqueio) {
    return { proximaEtapa: 'bloqueado', novoStatus: 'naoInteresse', acao: 'bloquear' };
  }

  // ============================================
  // 3) DETECÇÃO POR NÚMERO — mais confiável
  // ============================================
  // Verificar se é EXATAMENTE "1", "2" ou "3" (sem outras palavras relevantes)
  const apenasNumero = /^[1-3][\.\)\s]*$/.test(t);
  if (apenasNumero) {
    const num = parseInt(t.charAt(0));
    return resolverOpcao(num, etapaAtual);
  }

  // ============================================
  // 4) DETECÇÃO POR TEXTO — análise semântica flexível
  // ============================================
  const opcao1 = /\b(sim|quero|contratar|conhecer|aceito|bora|vamos|claro|com certeza|fechado|fechar|vamo|manda|pode|show|top|boa|massa|legal)\b/.test(t) ||
    t === '1' || t.startsWith('1 ') || t.startsWith('1.') || t.startsWith('1)');

  const opcao2 = /\b(tenho site|ja tenho|duvida|pergunta|algumas|como funciona|explica|informacoes|saber mais|me conta|fala mais)\b/.test(t) ||
    t === '2' || t.startsWith('2 ') || t.startsWith('2.') || t.startsWith('2)');

  const opcao3 = /\b(agora nao|pensar|depois|nao|talvez|mais tarde|nao quero|obrigado|valeu|sem interesse|nao preciso|vou pensar)\b/.test(t) ||
    t === '3' || t.startsWith('3 ') || t.startsWith('3.') || t.startsWith('3)');

  // Prioridade: opcao1 > opcao2 > opcao3
  // Se mais de uma bater, usamos prioridade
  if (opcao1 && !opcao3) {
    return resolverOpcao(1, etapaAtual);
  }
  if (opcao2 && !opcao1 && !opcao3) {
    return resolverOpcao(2, etapaAtual);
  }
  if (opcao3 && !opcao1) {
    return resolverOpcao(3, etapaAtual);
  }

  // ============================================
  // 5) NÃO ENTENDEU — reenviar opções
  // ============================================
  // Etapas terminais: qualquer texto vai para manual
  if (['msg3a', 'msg3c', 'msg2b_fim', 'atendimento_manual', 'bloqueado'].includes(etapaAtual)) {
    return { proximaEtapa: 'atendimento_manual', novoStatus: null, acao: 'manual' };
  }

  // Etapas com opções: pedir para escolher novamente
  logger.info('Resposta não reconhecida, reenviando opções', {
    texto: t.substring(0, 50),
    etapaAtual
  });

  return {
    proximaEtapa: etapaAtual, // Permanecer na mesma etapa
    novoStatus: null,          // Não mudar status
    acao: 'reenviar_opcoes'    // Sinalizar para reenviar
  };
}

/**
 * Resolve a opção numérica para a próxima etapa com base na etapa atual
 */
function resolverOpcao(opcao, etapaAtual) {
  const mapa = {
    'inicio': {
      1: { proximaEtapa: 'msg2', novoStatus: 'respondeu', acao: 'enviar_msg2' },
      2: { proximaEtapa: 'msg2b', novoStatus: 'respondeu', acao: 'enviar_msg2b' },
      3: { proximaEtapa: 'msg3c', novoStatus: 'naoInteresse', acao: 'enviar_msg3c' }
    },
    'msg1': {
      1: { proximaEtapa: 'msg2', novoStatus: 'respondeu', acao: 'enviar_msg2' },
      2: { proximaEtapa: 'msg2b', novoStatus: 'respondeu', acao: 'enviar_msg2b' },
      3: { proximaEtapa: 'msg3c', novoStatus: 'naoInteresse', acao: 'enviar_msg3c' }
    },
    'msg2': {
      1: { proximaEtapa: 'msg3a', novoStatus: 'interessado', acao: 'enviar_msg3a_notificar' },
      2: { proximaEtapa: 'msg3b', novoStatus: 'respondeu', acao: 'enviar_msg3b' },
      3: { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' }
    },
    'msg2b': {
      1: { proximaEtapa: 'msg2b_fim', novoStatus: 'naoInteresse', acao: 'enviar_msg2b_fim' },
      2: { proximaEtapa: 'msg2', novoStatus: 'respondeu', acao: 'enviar_msg2' },
      3: { proximaEtapa: 'msg2', novoStatus: 'respondeu', acao: 'enviar_msg2' }
    },
    'msg3b': {
      1: { proximaEtapa: 'msg3a', novoStatus: 'interessado', acao: 'enviar_msg3a_notificar' },
      2: { proximaEtapa: 'msg3b_repeat', novoStatus: 'respondeu', acao: 'enviar_msg3b_repeat' },
      3: { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' }
    },
    'msg3b_repeat': {
      1: { proximaEtapa: 'msg3a', novoStatus: 'interessado', acao: 'enviar_msg3a_notificar' },
      2: { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
      3: { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' }
    }
  };

  const etapaMapa = mapa[etapaAtual];
  if (!etapaMapa) {
    return { proximaEtapa: 'atendimento_manual', novoStatus: null, acao: 'manual' };
  }

  const resultado = etapaMapa[opcao];
  if (!resultado) {
    return { proximaEtapa: 'atendimento_manual', novoStatus: null, acao: 'manual' };
  }

  logger.info('Resposta detectada', {
    opcao,
    etapaAtual,
    proximaEtapa: resultado.proximaEtapa,
    acao: resultado.acao
  });

  return resultado;
}

module.exports = { detectarResposta };
