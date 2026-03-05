// GET /api/configuracoes/whatsapp/qrcode — Get QR Code (WPPConnect)
import type { NextApiRequest, NextApiResponse } from 'next';
import { verificarConexao, obterQRCodeCache, armazenarQRCode } from '../../../../lib/evolution';
import axios from 'axios';

const WPPCONNECT_URL = (process.env.WPPCONNECT_URL || 'http://localhost:21465').trim();
const WPPCONNECT_SECRET = (process.env.WPPCONNECT_SECRET_KEY || 'prospeccao-secret-2024').trim();
const SESSION = (process.env.WPPCONNECT_SESSION || 'prospeccao').trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const status = await verificarConexao();
    if (status.conectado) {
      return res.json({ sucesso: true, conectado: true });
    }

    // 1) Tentar cache de memória
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

    // 2) Fallback: buscar QR diretamente do WPPConnect via qrcode-session
    try {
      // Primeiro obter token
      const tokenRes = await axios.post(
        `${WPPCONNECT_URL}/api/${SESSION}/${WPPCONNECT_SECRET}/generate-token`,
        {},
        { timeout: 10000 }
      );
      const token = tokenRes.data?.token;

      if (token) {
        const qrRes = await axios.get(`${WPPCONNECT_URL}/api/${SESSION}/qrcode-session`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { image: true },
          timeout: 15000,
        });

        const qrBase64 = qrRes.data?.qrcode || qrRes.data?.base64;
        if (qrBase64 && typeof qrBase64 === 'string' && qrBase64.length > 50) {
          armazenarQRCode({ base64: qrBase64 });
          return res.json({
            sucesso: true,
            conectado: false,
            qrCode: qrBase64,
            pairingCode: null,
            count: 1,
            expirado: false,
          });
        }
      }
    } catch (e: any) {
      console.log(`[QR] Fallback WPPConnect falhou: ${e.message}`);
    }

    // 3) Sem QR disponível
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
