// POST /api/contatos/importar — Import CSV
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // For Vercel serverless, we handle CSV as text body
    // Frontend should send CSV content as JSON { registros: [...] }
    const { registros } = req.body;

    if (!registros || !Array.isArray(registros)) {
      return res.status(400).json({ error: 'Envie { registros: [{nome, telefone, ...}] }' });
    }

    let importados = 0;
    let duplicados = 0;
    let erros = 0;

    for (const reg of registros) {
      try {
        const telefone = (reg.telefone || reg.phone || '').replace(/\D/g, '');
        const nome = reg.nome || reg.name || 'Sem nome';
        if (!telefone || telefone.length < 10) { erros++; continue; }

        await prisma.contato.create({
          data: {
            nome,
            telefone,
            escritorio: reg.escritorio || reg.office || null,
            cidade: reg.cidade || reg.city || null,
            areaAtuacao: reg.area_atuacao || reg.areaAtuacao || reg.area || null,
          },
        });
        importados++;
      } catch (e: any) {
        if (e.code === 'P2002') duplicados++;
        else erros++;
      }
    }

    res.json({ mensagem: 'Importação concluída', importados, duplicados, erros, total: registros.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
