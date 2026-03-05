// GET /api/contatos/exportar/csv — Export contacts as CSV
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const contatos = await prisma.contato.findMany({ orderBy: { criadoEm: 'desc' } });
    const csv = [
      'nome,telefone,escritorio,cidade,area_atuacao,status,etapa_bot,criado_em',
      ...contatos.map(
        (c) =>
          `"${c.nome}","${c.telefone}","${c.escritorio || ''}","${c.cidade || ''}","${c.areaAtuacao || ''}","${c.status}","${c.etapaBot}","${c.criadoEm.toISOString()}"`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contatos.csv');
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
