// GET /api/configuracoes/whatsapp/qrcode — Get QR Code
import type { NextApiRequest, NextApiResponse } from 'next';
import { verificarConexao, obterQRCodeCache, armazenarQRCode } from '../../../../lib/evolution';
import axios from 'axios';

const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').trim();
const EVOLUTION_KEY = (process.env.EVOLUTION_API_KEY || '').trim().replace(/[\r\n\t\x00-\x1F\x7F]+/g, '');
const INSTANCE = (process.env.EVOLUTION_INSTANCE || 'prospeccao').trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const status = await verificarConexao();
    if (status.conectado) {
      return res.json({ sucesso: true, conectado: true });
    }

    // 1) Tentar cache de memória (recebido via webhook)
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

    // 2) Fallback: buscar QR diretamente da Evolution API via connect
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (EVOLUTION_KEY) headers['apikey'] = EVOLUTION_KEY;

      const connectRes = await axios.get(`${EVOLUTION_URL}/instance/connect/${INSTANCE}`, {
        headers,
        timeout: 15000,
      });
      const data = connectRes.data;
      const base64QR = data?.base64 || data?.qrcode?.base64;
      const pairingCode = data?.pairingCode;

      if (base64QR && typeof base64QR === 'string' && base64QR.length > 50) {
        armazenarQRCode({ base64: base64QR, pairingCode, code: data?.code });
        return res.json({
          sucesso: true,
          conectado: false,
          qrCode: base64QR,
          pairingCode: pairingCode || null,
          count: 1,
          expirado: false,
        });
      }

      if (pairingCode) {
        return res.json({
          sucesso: true,
          conectado: false,
          qrCode: null,
          pairingCode,
          aguardando: false,
        });
      }
    } catch (e: any) {
      console.log(`[QR] Fallback connect falhou: ${e.message}`);
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
