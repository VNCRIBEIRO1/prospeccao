// ============================================
// GET/POST /api/pedidos — Gerenciamento de Pedidos
// ============================================
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ─── GET — Listar pedidos com filtros e stats ───
  if (req.method === 'GET') {
    try {
      const { status, busca, limit = '50', page = '1' } = req.query;

      const where: any = {};
      if (status && status !== 'todos') where.status = status;
      if (busca) {
        const b = String(busca);
        where.OR = [
          { codigo: { contains: b, mode: 'insensitive' } },
          { nomeCliente: { contains: b, mode: 'insensitive' } },
          { escritorio: { contains: b, mode: 'insensitive' } },
          { telefone: { contains: b } },
          { cidade: { contains: b, mode: 'insensitive' } },
        ];
      }

      const take = Math.min(parseInt(String(limit)), 100);
      const skip = (parseInt(String(page)) - 1) * take;

      const [pedidos, total] = await Promise.all([
        prisma.pedido.findMany({
          where,
          include: { contato: true },
          orderBy: { criadoEm: 'desc' },
          take,
          skip,
        }),
        prisma.pedido.count({ where }),
      ]);

      // Stats
      const [novos, aprovados, emDesenvolvimento, concluidos, cancelados] = await Promise.all([
        prisma.pedido.count({ where: { status: 'novo' } }),
        prisma.pedido.count({ where: { status: 'aprovado' } }),
        prisma.pedido.count({ where: { status: 'em_desenvolvimento' } }),
        prisma.pedido.count({ where: { status: 'concluido' } }),
        prisma.pedido.count({ where: { status: 'cancelado' } }),
      ]);

      return res.json({
        pedidos,
        total,
        totalPaginas: Math.ceil(total / take),
        stats: { novos, aprovados, emDesenvolvimento, concluidos, cancelados },
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─── POST — Criar pedido manualmente ───
  if (req.method === 'POST') {
    try {
      const { nomeCliente, telefone, escritorio, cidade, areaAtuacao, tipo, notas } = req.body;

      if (!nomeCliente || !telefone) {
        return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
      }

      const telLimpo = telefone.replace(/\D/g, '');

      // Buscar ou criar contato
      let contato = await prisma.contato.findFirst({ where: { telefone: telLimpo } });
      if (!contato) {
        contato = await prisma.contato.create({
          data: {
            nome: nomeCliente,
            telefone: telLimpo,
            escritorio: escritorio || null,
            cidade: cidade || null,
            areaAtuacao: areaAtuacao || null,
            status: 'interessado',
            etapaBot: 'msg_enviar_docs',
          },
        });
      }

      // Gerar código
      const hoje = new Date();
      const data = hoje.toISOString().slice(0, 10).replace(/-/g, '');
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);
      const count = await prisma.pedido.count({
        where: { criadoEm: { gte: inicioDia, lt: fimDia } },
      });
      const codigo = `PED-${data}-${String(count + 1).padStart(3, '0')}`;

      // Criar pedido
      const pedido = await prisma.pedido.create({
        data: {
          codigo,
          contatoId: contato.id,
          nomeCliente,
          escritorio: escritorio || null,
          cidade: cidade || null,
          areaAtuacao: areaAtuacao || null,
          telefone: telLimpo,
          tipo: tipo || 'site_chatbot',
          status: 'novo',
          notas: notas || null,
        },
        include: { contato: true },
      });

      // Criar notificação
      await prisma.notificacao.create({
        data: {
          tipo: 'pedido_manual',
          titulo: '📋 Novo pedido manual criado',
          mensagem: `Pedido ${codigo} — ${nomeCliente} (${telLimpo})`,
          dados: JSON.stringify({ pedidoId: pedido.id, codigo, contatoId: contato.id }),
        },
      });

      return res.json(pedido);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
