// GET /api/configuracoes/whatsapp/qrcode — Get QR Code
import type { NextApiRequest, NextApiResponse } from 'next';
import { verificarConexao, obterQRCodeCache } from '../../../../lib/evolution';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const status = await verificarConexao();
    if (status.conectado) {
      return res.json({ sucesso: true, conectado: true });
    }

    const qrCache = obterQRCodeCache();
    if (qrCache && qrCache.base64 && !qrCache.expirado) {
      return res.json({
        sucesso: true,
        conectado: false,
        qrCode: qrCache.base64,
        pairingCode: qrCache.pairingCode,
        count: qrCache.count,
        expirado: false,
      });
    }

    res.json({
      sucesso: true,
      conectado: false,
      qrCode: null,
      pairingCode: qrCache?.pairingCode || null,
      expirado: qrCache?.expirado || false,
      aguardando: true,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
