// POST /api/contatos/importar — Import CSV (aceita JSON ou texto CSV)
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/["']/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (vals.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = vals[j] || ''; });
    rows.push(row);
  }
  return rows;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let registros: Record<string, string>[] = [];

    if (req.body?.registros && Array.isArray(req.body.registros)) {
      registros = req.body.registros;
    } else if (req.body?.csv && typeof req.body.csv === 'string') {
      registros = parseCSV(req.body.csv);
    } else if (typeof req.body === 'string') {
      registros = parseCSV(req.body);
    } else {
      return res.status(400).json({ error: 'Envie { registros: [...] } ou { csv: "texto CSV" }' });
    }

    if (registros.length === 0) {
      return res.status(400).json({ error: 'Nenhum registro encontrado no CSV' });
    }

    let importados = 0;
    let duplicados = 0;
    let erros = 0;

    for (const reg of registros) {
      try {
        const telefone = (reg.telefone || reg.phone || reg.tel || reg.whatsapp || '').replace(/\D/g, '');
        const nome = reg.nome || reg.name || reg.empresa || 'Sem nome';
        if (!telefone || telefone.length < 10) { erros++; continue; }

        await prisma.contato.create({
          data: {
            nome,
            telefone,
            escritorio: reg.escritorio || reg.office || reg.empresa || null,
            cidade: reg.cidade || reg.city || reg.uf || null,
            areaAtuacao: reg.area_atuacao || reg.areaAtuacao || reg.area || reg.especialidade || null,
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
