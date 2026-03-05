// ============================================
// Detecção de Resposta — Motor de decisão do Bot
// ============================================

interface ResultadoDeteccao {
  proximaEtapa: string;
  novoStatus: string | null;
  acao: string;
}

function resolverOpcao(opcao: number, etapaAtual: string): ResultadoDeteccao {
  const mapa: Record<string, Record<number, ResultadoDeteccao>> = {
    inicio: {
      1: { proximaEtapa: 'msg2', novoStatus: 'respondeu', acao: 'enviar_msg2' },
      2: { proximaEtapa: 'msg2b', novoStatus: 'respondeu', acao: 'enviar_msg2b' },
      3: { proximaEtapa: 'msg3c', novoStatus: 'naoInteresse', acao: 'enviar_msg3c' },
    },
    msg1: {
      1: { proximaEtapa: 'msg2', novoStatus: 'respondeu', acao: 'enviar_msg2' },
      2: { proximaEtapa: 'msg2b', novoStatus: 'respondeu', acao: 'enviar_msg2b' },
      3: { proximaEtapa: 'msg3c', novoStatus: 'naoInteresse', acao: 'enviar_msg3c' },
    },
    msg2: {
      1: { proximaEtapa: 'msg3a', novoStatus: 'interessado', acao: 'enviar_msg3a_notificar' },
      2: { proximaEtapa: 'msg3b', novoStatus: 'respondeu', acao: 'enviar_msg3b' },
      3: { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
    },
    msg2b: {
      1: { proximaEtapa: 'msg2b_fim', novoStatus: 'naoInteresse', acao: 'enviar_msg2b_fim' },
      2: { proximaEtapa: 'msg2', novoStatus: 'respondeu', acao: 'enviar_msg2' },
      3: { proximaEtapa: 'msg2', novoStatus: 'respondeu', acao: 'enviar_msg2' },
    },
    msg3b: {
      1: { proximaEtapa: 'msg3a', novoStatus: 'interessado', acao: 'enviar_msg3a_notificar' },
      2: { proximaEtapa: 'msg3b_repeat', novoStatus: 'respondeu', acao: 'enviar_msg3b_repeat' },
      3: { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
    },
    msg3b_repeat: {
      1: { proximaEtapa: 'msg3a', novoStatus: 'interessado', acao: 'enviar_msg3a_notificar' },
      2: { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
      3: { proximaEtapa: 'msg3c', novoStatus: 'pendente_followup', acao: 'enviar_msg3c' },
    },
  };

  const etapaMapa = mapa[etapaAtual];
  if (!etapaMapa) return { proximaEtapa: 'atendimento_manual', novoStatus: null, acao: 'manual' };
  const resultado = etapaMapa[opcao];
  if (!resultado) return { proximaEtapa: 'atendimento_manual', novoStatus: null, acao: 'manual' };
  return resultado;
}

export function detectarResposta(texto: string, etapaAtual: string, buttonId?: string | null): ResultadoDeteccao {
  const t = (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // 1) Button click (ainda funciona caso o WhatsApp reabilite botoes no futuro)
  if (buttonId) {
    const opcao = buttonId === 'opt_1' ? 1 : buttonId === 'opt_2' ? 2 : buttonId === 'opt_3' ? 3 : 0;
    if (opcao > 0) return resolverOpcao(opcao, etapaAtual);
  }

  // 2) Block words
  const bloqueio = /\b(parar|pare|bloquear|spam|denuncia|denunciar|sair|remover|cancelar|nao me mande|pare de|nao quero mais|me tire|me remove)\b/.test(t);
  if (bloqueio) return { proximaEtapa: 'bloqueado', novoStatus: 'naoInteresse', acao: 'bloquear' };

  // 3) Numero digitado (1, 2 ou 3) — aceita emoji, ponto, parentese, espaco
  const limpo = t.replace(/[\ufe0f\u20e3]/g, ''); // remove emoji variation selectors
  const matchNumero = limpo.match(/^[^\d]*([1-3])[^\d]*$/);
  if (matchNumero) return resolverOpcao(parseInt(matchNumero[1]), etapaAtual);

  // 3b) Emoji de numero (1️⃣, 2️⃣, 3️⃣)
  if (/1\ufe0f?\u20e3/.test(texto)) return resolverOpcao(1, etapaAtual);
  if (/2\ufe0f?\u20e3/.test(texto)) return resolverOpcao(2, etapaAtual);
  if (/3\ufe0f?\u20e3/.test(texto)) return resolverOpcao(3, etapaAtual);

  // 4) Text analysis
  const opcao1 = /\b(sim|quero|contratar|conhecer|aceito|bora|vamos|claro|com certeza|fechado|fechar|vamo|manda|pode|show|top|boa|massa|legal)\b/.test(t);
  const opcao2 = /\b(tenho site|ja tenho|duvida|pergunta|algumas|como funciona|explica|informacoes|saber mais|me conta|fala mais)\b/.test(t);
  const opcao3 = /\b(agora nao|pensar|depois|nao|talvez|mais tarde|nao quero|obrigado|valeu|sem interesse|nao preciso|vou pensar)\b/.test(t);

  if (opcao1 && !opcao3) return resolverOpcao(1, etapaAtual);
  if (opcao2 && !opcao1 && !opcao3) return resolverOpcao(2, etapaAtual);
  if (opcao3 && !opcao1) return resolverOpcao(3, etapaAtual);

  // 5) Terminal stages
  if (['msg3a', 'msg3c', 'msg2b_fim', 'atendimento_manual', 'bloqueado'].includes(etapaAtual)) {
    return { proximaEtapa: 'atendimento_manual', novoStatus: null, acao: 'manual' };
  }

  return { proximaEtapa: etapaAtual, novoStatus: null, acao: 'reenviar_opcoes' };
}
