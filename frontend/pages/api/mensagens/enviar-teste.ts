// POST /api/mensagens/enviar-teste — Send test message COM botões interativos
// Corrigido: agora envia multi-mensagem + botões nativos, igual ao webhook
// IMPORTANTE: Atualiza etapaBot do contato no banco para que o fluxo funcione
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { enviarMensagem, enviarMensagemComBotoes } from '../../../lib/evolution';
import { FLUXO } from '../../../lib/mensagens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { telefone, etapa } = req.body;

    if (!telefone) return res.status(400).json({ error: 'Telefone é obrigatório' });
    if (!etapa) return res.status(400).json({ error: 'Etapa é obrigatória' });

    const fluxo = FLUXO[etapa];
    if (!fluxo) return res.status(400).json({ error: `Etapa "${etapa}" não encontrada` });

    // ═══ SINCRONIZAR ETAPA NO BANCO ═══
    // Sem isso, quando o usuário responde ao botão, o webhook lê a etapaBot
    // antiga do banco e processa na etapa errada → fluxo quebra
    let telefoneFormatado = telefone.replace(/\D/g, '');
    if (!telefoneFormatado.startsWith('55')) telefoneFormatado = '55' + telefoneFormatado;

    let contato = await prisma.contato.findFirst({
      where: { OR: [{ telefone: telefoneFormatado }, { telefone: telefone.replace(/\D/g, '') }] },
    });

    if (contato) {
      // Atualizar etapaBot para a etapa que estamos enviando
      await prisma.contato.update({
        where: { id: contato.id },
        data: { etapaBot: etapa, status: 'respondeu' },
      });
      console.log(`[EnviarTeste] 📝 Contato ${contato.id} atualizado para etapa "${etapa}"`);
    } else {
      // Criar contato novo para o teste
      contato = await prisma.contato.create({
        data: {
          nome: 'Teste Manual',
          telefone: telefoneFormatado,
          status: 'respondeu',
          etapaBot: etapa,
        },
      });
      console.log(`[EnviarTeste] 🆕 Contato ${contato.id} criado na etapa "${etapa}"`);
    }

    const textos = fluxo.textos;
    const botoes = fluxo.botoes;
    const rodape = fluxo.rodape || 'Toque em uma opção 👆';

    // Enviar multi-mensagem + botões (igual ao webhook)
    // Textos intermediários vão como texto puro
    // Último texto vai com botões interativos (se houver)
    for (let i = 0; i < textos.length; i++) {
      const texto = textos[i];
      const isUltimo = i === textos.length - 1;

      let resultado;
      if (isUltimo && botoes && botoes.length > 0) {
        // Último texto + botões interativos nativos
        resultado = await enviarMensagemComBotoes(telefone, texto, botoes, rodape);
      } else {
        // Textos intermediários: texto puro
        resultado = await enviarMensagem(telefone, texto);
      }

      if (!resultado.sucesso) {
        return res.status(500).json({
          sucesso: false,
          erro: resultado.erro || 'Erro ao enviar mensagem',
          textoIndex: i,
        });
      }

      // Delay entre mensagens múltiplas (simula digitação)
      if (!isUltimo && textos.length > 1) {
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
      }
    }

    // Registrar mensagem enviada no banco
    await prisma.mensagem.create({
      data: {
        contatoId: contato.id,
        direcao: 'enviada',
        conteudo: `[Teste manual] ${etapa}`,
        etapa,
      },
    });

    return res.json({
      sucesso: true,
      etapa,
      contatoId: contato.id,
      tipo: botoes && botoes.length > 0 ? 'botoes_interativos' : 'texto',
      totalMensagens: textos.length,
      temBotoes: !!(botoes && botoes.length > 0),
    });
  } catch (error: any) {
    console.error('Erro ao enviar teste:', error);
    return res.status(500).json({ error: error.message });
  }
}
