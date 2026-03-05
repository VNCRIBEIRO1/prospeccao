import { useEffect, useState } from 'react';
import api from '../lib/api';
import { QrCode, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export default function QRCodeComponent() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    verificarStatus();
    const interval = setInterval(verificarStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function verificarStatus() {
    try {
      const { data } = await api.get('/configuracoes/whatsapp/status');
      setConectado(data.conectado);
      if (data.conectado) setQrCode(null);
    } catch {
      setConectado(false);
    }
  }

  async function gerarQRCode() {
    setLoading(true);
    try {
      const { data } = await api.post('/configuracoes/whatsapp/conectar');
      if (data.sucesso) {
        const qr = data.data?.base64 || data.data?.qrcode?.base64;
        if (qr) {
          setQrCode(qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`);
        }
      }
    } catch (error) {
      console.error('Erro ao gerar QR:', error);
    } finally {
      setLoading(false);
    }
  }

  if (conectado) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
        <Wifi className="w-6 h-6 text-green-400" />
        <div>
          <p className="text-green-400 font-medium">WhatsApp Conectado</p>
          <p className="text-xs text-green-300/70">Pronto para enviar mensagens</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-slate-800 border border-slate-700 rounded-xl">
      {qrCode ? (
        <>
          <div className="p-4 bg-white rounded-xl">
            <img src={qrCode} alt="QR Code" className="w-56 h-56" />
          </div>
          <p className="text-sm text-slate-400 text-center">
            Abra o WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar
          </p>
          <button
            onClick={gerarQRCode}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Gerar novo QR Code
          </button>
        </>
      ) : (
        <>
          <WifiOff className="w-12 h-12 text-red-400" />
          <p className="text-slate-400 text-sm">WhatsApp não conectado</p>
          <button
            onClick={gerarQRCode}
            disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            Conectar WhatsApp
          </button>
        </>
      )}
    </div>
  );
}
