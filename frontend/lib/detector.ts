// ============================================
// Detecção de Resposta — Motor de decisão do Bot
// REESTRUTURADO: Usa TRANSICOES por buttonId nomeado
// Suporta: botões nativos, listas, texto livre, números legados
// ============================================
import { TRANSICOES, MAPA_NUMERICO, FLUXO } from './mensagens';
import type { Transicao } from './mensagens';

export interface ResultadoDeteccao {
  proximaEtapa: string;
  novoStatus: string | null;
  acao: string;
  buttonId?: string; // O botão que foi resolvido
}

const ETAPAS_TERMINAIS = ['msg3a', 'msg3c', 'msg2b_fim', 'atendimento_manual', 'bloqueado'];

// Palavras/frases que bloqueiam o bot imediatamente
const REGEX_BLOQUEIO = /\b(parar|pare|bloquear|spam|denuncia|denunciar|sair|remover|cancelar|stop|chega|nao insista)\b|nao me mande|pare de|para de me|nao quero mais|me tire|me remove|nao manda mais|nao mande mais|para com isso/;

// Palavras-chave por intenção — POR ETAPA (corrige falsos positivos)
// Cada etapa tem mapeamento específico: regex → número da opção
const SEMANTICA_POR_ETAPA: Record<string, Array<{ regex: RegExp; opcao: number }>> = {
  // inicio: alias de msg1 (default do Prisma)
  inicio: [
    { regex: /\b(sim|quero|conhecer|aceito|bora|vamos|claro|com certeza|fechado|fechar|vamo|manda|pode|show|top|boa|massa|legal|interesse|interessado|como funciona|me conta|fala mais|saber mais|explica|informacoes)\b/, opcao: 1 },
    { regex: /\b(tenho site|ja tenho|meu site|nosso site|temos site)\b/, opcao: 2 },
    { regex: /\b(agora nao|nao|depois|talvez|mais tarde|nao quero|obrigado|valeu|sem interesse|nao preciso|vou pensar|nao agora)\b/, opcao: 3 },
  ],
  // msg1: 1=Quero conhecer, 2=Já tenho site, 3=Agora não
  msg1: [
    { regex: /\b(sim|quero|conhecer|aceito|bora|vamos|claro|com certeza|fechado|fechar|vamo|manda|pode|show|top|boa|massa|legal|interesse|interessado|como funciona|me conta|fala mais|saber mais|explica|informacoes)\b/, opcao: 1 },
    { regex: /\b(tenho site|ja tenho|meu site|nosso site|temos site)\b/, opcao: 2 },
    { regex: /\b(agora nao|nao|depois|talvez|mais tarde|nao quero|obrigado|valeu|sem interesse|nao preciso|vou pensar|nao agora)\b/, opcao: 3 },
  ],
  // msg2: 1=Quero contratar, 2=Tenho dúvidas, 3=Vou pensar
  msg2: [
    { regex: /\b(sim|quero|contratar|aceito|bora|vamos|claro|com certeza|fechado|fechar|vamo|manda|pode|show|top|massa|legal)\b/, opcao: 1 },
    { regex: /\b(duvida|pergunta|como funciona|explica|saber mais|me conta|fala mais|informacoes)\b/, opcao: 2 },
    { regex: /\b(pensar|depois|talvez|mais tarde|nao agora|vou pensar|deixa|nao sei)\b/, opcao: 3 },
  ],
  // msg2b: 1=Tem tudo, 2=Tem algumas coisas, 3=Não tem
  msg2b: [
    { regex: /\b(sim|tudo|completo|tem sim|tenho tudo)\b/, opcao: 1 },
    { regex: /\b(parcial|algumas|algumas coisas|parte|mais ou menos|nem tudo)\b/, opcao: 2 },
    { regex: /\b(nao|nao tem|nenhum|nada|me conta|quero saber)\b/, opcao: 3 },
  ],
  // msg3b: 1=Quero contratar, 2=Mais dúvidas, 3=Vou pensar
  msg3b: [
    { regex: /\b(sim|quero|contratar|aceito|bora|vamos|claro|com certeza|fechado|fechar|vamo|manda|pode|show|top)\b/, opcao: 1 },
    { regex: /\b(duvida|pergunta|como funciona|explica|saber mais|outra)\b/, opcao: 2 },
    { regex: /\b(pensar|depois|talvez|mais tarde|nao agora|vou pensar|deixa)\b/, opcao: 3 },
  ],
  // msg3b_repeat: 1=Quero contratar, 2=Vou pensar
  msg3b_repeat: [
    { regex: /\b(sim|quero|contratar|aceito|bora|vamos|claro|com certeza|fechado|fechar|vamo|manda|pode|show|top)\b/, opcao: 1 },
    { regex: /\b(pensar|depois|talvez|mais tarde|nao agora|vou pensar|deixa|nao|obrigado|valeu)\b/, opcao: 2 },
  ],
};

/**
 * Detecta a intenção do usuário e retorna a próxima etapa do fluxo.
 *
 * Prioridade de detecção:
 * 1. buttonId direto (clique em botão nativo WPPConnect)
 * 2. Palavras de bloqueio
 * 3. Número digitado (1, 2, 3) → mapeado para buttonId via MAPA_NUMERICO
 * 4. Texto do botão (match exato ou parcial no texto dos botões da etapa)
 * 5. Análise semântica por palavras-chave
 * 6. Fallback: reenviar opções ou encaminhar para manual
 */
export function detectarResposta(
  texto: string,
  etapaAtual: string,
  buttonId?: string | null
): ResultadoDeteccao {
  const t = (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // ════════════════════════════════════════
  // 1) BOTÃO NATIVO — Clicou em botão interativo WPPConnect
  //    O buttonId vem direto do payload (ex: "msg1_sim", "msg2_contratar")
  //    VALIDAÇÃO: Só aceita se o botão pertence à etapa atual
  // ════════════════════════════════════════
  if (buttonId) {
    const transicao = TRANSICOES[buttonId];
    if (transicao) {
      // Verificar se o botão pertence à etapa atual
      const etapaFluxoAtual = FLUXO[etapaAtual];
      const botaoPertence = etapaFluxoAtual?.botoes?.some(b => b.id === buttonId) ?? false;

      if (botaoPertence) {
        console.log(`[Detector] ✅ Botão nativo: ${buttonId} → ${transicao.proximaEtapa}`);
        return { ...transicao, buttonId };
      } else {
        // Botão de OUTRA etapa — ignorar, tratar como texto livre
        console.log(`[Detector] ⚠️ Botão "${buttonId}" não pertence à etapa ${etapaAtual} — ignorando`);
      }
    }

    // Compatibilidade: buttonId legado (opt_1, opt_2, opt_3)
    const opcaoLegada = buttonId === 'opt_1' ? 1 : buttonId === 'opt_2' ? 2 : buttonId === 'opt_3' ? 3 : 0;
    if (opcaoLegada > 0) {
      const resolved = resolverPorNumero(opcaoLegada, etapaAtual);
      if (resolved) {
        console.log(`[Detector] ✅ Botão legado: ${buttonId} → num ${opcaoLegada} → ${resolved.proximaEtapa}`);
        return resolved;
      }
    }
  }

  // ════════════════════════════════════════
  // 2) BLOQUEIO — Parar bot imediatamente
  // ════════════════════════════════════════
  if (REGEX_BLOQUEIO.test(t)) {
    console.log(`[Detector] 🚫 Bloqueio detectado: "${t.substring(0, 30)}"`);
    return { proximaEtapa: 'bloqueado', novoStatus: 'naoInteresse', acao: 'bloquear' };
  }

  // ════════════════════════════════════════
  // 3) NÚMERO DIGITADO — "1", "2", "3"
  //    Mapeado para buttonId via MAPA_NUMERICO
  // ════════════════════════════════════════
  const limpo = t.replace(/[\ufe0f\u20e3]/g, ''); // Remove emoji variation selectors
  const matchNumero = limpo.match(/^[^\d]*([1-3])[^\d]*$/);
  if (matchNumero) {
    const num = parseInt(matchNumero[1]);
    const resolved = resolverPorNumero(num, etapaAtual);
    if (resolved) {
      console.log(`[Detector] 🔢 Número digitado: ${num} → ${resolved.proximaEtapa}`);
      return resolved;
    }
  }

  // Emoji de número (1️⃣, 2️⃣, 3️⃣)
  if (/1\ufe0f?\u20e3/.test(texto)) {
    const r = resolverPorNumero(1, etapaAtual);
    if (r) return r;
  }
  if (/2\ufe0f?\u20e3/.test(texto)) {
    const r = resolverPorNumero(2, etapaAtual);
    if (r) return r;
  }
  if (/3\ufe0f?\u20e3/.test(texto)) {
    const r = resolverPorNumero(3, etapaAtual);
    if (r) return r;
  }

  // ════════════════════════════════════════
  // 4) TEXTO DO BOTÃO — Match no texto dos botões da etapa atual
  //    Ex: lead digita "quero contratar" que é similar ao texto do botão
  // ════════════════════════════════════════
  const etapaFluxo = FLUXO[etapaAtual];
  if (etapaFluxo?.botoes) {
    for (const botao of etapaFluxo.botoes) {
      const textoBotao = botao.texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim();
      // Match se o texto digitado contém palavras significativas do botão
      const palavrasBotao = textoBotao.split(/\s+/).filter(p => p.length > 2);
      const matchCount = palavrasBotao.filter(p => t.includes(p)).length;
      if (matchCount >= 2 || (palavrasBotao.length <= 2 && matchCount >= 1 && t.length < 30)) {
        const transicao = TRANSICOES[botao.id];
        if (transicao) {
          console.log(`[Detector] 📝 Match texto botão: "${t.substring(0, 30)}" → ${botao.id} → ${transicao.proximaEtapa}`);
          return { ...transicao, buttonId: botao.id };
        }
      }
    }
  }

  // ════════════════════════════════════════
  // 5) ANÁLISE SEMÂNTICA — Palavras-chave POR ETAPA
  //    Cada etapa tem seus próprios mapeamentos de intenção
  // ════════════════════════════════════════
  const semanticaEtapa = SEMANTICA_POR_ETAPA[etapaAtual];
  if (semanticaEtapa) {
    // Encontrar todas as opções que deram match
    const matches = semanticaEtapa.filter(s => s.regex.test(t));

    if (matches.length === 1) {
      // Match único — confiável
      const r = resolverPorNumero(matches[0].opcao, etapaAtual);
      if (r) {
        console.log(`[Detector] 💬 Semântica etapa ${etapaAtual} opção ${matches[0].opcao}: "${t.substring(0, 30)}"`);
        return r;
      }
    } else if (matches.length > 1) {
      // Múltiplos matches — priorizar opção 1 (positiva) se não conflita com opção 3 (negativa)
      const temPositivo = matches.some(m => m.opcao === 1);
      const temNegativo = matches.some(m => m.opcao === 3 || m.opcao === 2);
      if (temPositivo && !temNegativo) {
        const r = resolverPorNumero(1, etapaAtual);
        if (r) {
          console.log(`[Detector] 💬 Semântica conflito resolvido → opção 1: "${t.substring(0, 30)}"`);
          return r;
        }
      }
      // Se conflita, vai para fallback (reenviar opções)
      console.log(`[Detector] ⚠️ Semântica ambígua (${matches.map(m => m.opcao).join(',')}): "${t.substring(0, 30)}"`);
    }
  }

  // ════════════════════════════════════════
  // 6) FALLBACK — Não entendeu
  // ════════════════════════════════════════

  // Etapas terminais → atendimento manual
  if (ETAPAS_TERMINAIS.includes(etapaAtual)) {
    console.log(`[Detector] 👤 Etapa terminal, encaminhando para manual: ${etapaAtual}`);
    return { proximaEtapa: 'atendimento_manual', novoStatus: null, acao: 'manual' };
  }

  // Etapas com opções → reenviar botões
  console.log(`[Detector] ⚠️ Não reconhecido: "${t.substring(0, 40)}" na etapa ${etapaAtual}`);
  return { proximaEtapa: etapaAtual, novoStatus: null, acao: 'reenviar_opcoes' };
}

/**
 * Resolve um número (1, 2, 3) para o buttonId correspondente
 * usando o MAPA_NUMERICO da etapa atual
 */
function resolverPorNumero(numero: number, etapaAtual: string): ResultadoDeteccao | null {
  const mapa = MAPA_NUMERICO[etapaAtual];
  if (!mapa) return null;

  const buttonId = mapa[numero];
  if (!buttonId) return null;

  const transicao = TRANSICOES[buttonId];
  if (!transicao) return null;

  return { ...transicao, buttonId };
}
