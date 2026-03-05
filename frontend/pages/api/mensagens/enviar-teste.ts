// POST /api/mensagens/enviar-teste — Send test message (texto puro com opcoes numeradas)
import type { NextApiRequest, NextApiResponse } from 'next';
import { enviarMensagem } from '../../../lib/evolution';
import { MENSAGENS } from '../../../lib/mensagens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { telefone, etapa } = req.body;

    if (!telefone) return res.status(400).json({ error: 'Telefone é obrigatório' });
    if (!etapa) return res.status(400).json({ error: 'Etapa é obrigatória' });

    const mensagem = MENSAGENS[etapa];
    if (!mensagem) return res.status(400).json({ error: `Etapa "${etapa}" não encontrada` });

    // Sempre envia como texto puro — opcoes numeradas ja embutidas na mensagem
    const resultado = await enviarMensagem(telefone, mensagem);

    if (resultado.sucesso) {
      return res.json({
        sucesso: true,
        etapa,
        tipo: 'texto',
        data: resultado.data,
      });
    } else {
      return res.status(500).json({
        sucesso: false,
        erro: resultado.erro || 'Erro ao enviar mensagem',
      });
    }
  } catch (error: any) {
    console.error('Erro ao enviar teste:', error);
    return res.status(500).json({ error: error.message });
  }
}
