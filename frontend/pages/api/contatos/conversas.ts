// GET /api/contatos/conversas — Conversas ativas com mensagens nao lidas
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { tipo = 'todas' } = req.query;

    let where: any = {};

    if (tipo === 'pendentes') {
      // Contatos que responderam e estao esperando atencao
      where.status = { in: ['respondeu', 'interessado', 'pendente_followup'] };
    } else if (tipo === 'quentes') {
      where.status = 'interessado';
    } else if (tipo === 'followup') {
      where.status = 'pendente_followup';
    }

    // Buscar contatos com pelo menos 1 mensagem recebida
    const contatos = await prisma.contato.findMany({
      where: {
        ...where,
        mensagens: { some: { direcao: 'recebida' } },
      },
      include: {
        mensagens: {
          orderBy: { criadoEm: 'desc' },
          take: 1,
        },
        _count: {
          select: { mensagens: true },
        },
      },
      orderBy: { atualizadoEm: 'desc' },
      take: 100,
    });

    // Contar mensagens recebidas nao lidas (depois da ultima enviada)
    const conversas = await Promise.all(contatos.map(async (c) => {
      const ultimaEnviada = await prisma.mensagem.findFirst({
        where: { contatoId: c.id, direcao: 'enviada' },
        orderBy: { criadoEm: 'desc' },
      });

      const recebidasDepois = ultimaEnviada
        ? await prisma.mensagem.count({
            where: { contatoId: c.id, direcao: 'recebida', criadoEm: { gt: ultimaEnviada.criadoEm } },
          })
        : await prisma.mensagem.count({
            where: { contatoId: c.id, direcao: 'recebida' },
          });

      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        escritorio: c.escritorio,
        cidade: c.cidade,
        areaAtuacao: c.areaAtuacao,
        status: c.status,
        etapaBot: c.etapaBot,
        ultimaMensagem: c.mensagens[0]?.conteudo?.substring(0, 100) || '',
        ultimaMensagemData: c.mensagens[0]?.criadoEm || null,
        ultimaDirecao: c.mensagens[0]?.direcao || '',
        totalMensagens: c._count.mensagens,
        naoLidas: recebidasDepois,
        whatsappLink: `https://wa.me/${c.telefone.replace(/\D/g, '')}`,
      };
    }));

    // Ordenar: nao lidas primeiro, depois por data
    conversas.sort((a, b) => {
      if (a.naoLidas > 0 && b.naoLidas === 0) return -1;
      if (a.naoLidas === 0 && b.naoLidas > 0) return 1;
      const da = a.ultimaMensagemData ? new Date(a.ultimaMensagemData).getTime() : 0;
      const db = b.ultimaMensagemData ? new Date(b.ultimaMensagemData).getTime() : 0;
      return db - da;
    });

    // Resumo
    const resumo = {
      total: conversas.length,
      naoLidas: conversas.filter(c => c.naoLidas > 0).length,
      quentes: conversas.filter(c => c.status === 'interessado').length,
      followup: conversas.filter(c => c.status === 'pendente_followup').length,
    };

    res.json({ resumo, conversas });
  } catch (error: any) {
    console.error('[Conversas] Erro:', error);
    res.status(500).json({ error: error.message });
  }
}
