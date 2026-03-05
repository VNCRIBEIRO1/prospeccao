import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { Save, Wifi, WifiOff, QrCode, RefreshCw, Download, AlertCircle, CheckCircle, XCircle, Loader2, Smartphone, LogOut, RotateCcw, Webhook, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

type ConnectionState = 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error';

export default function Configuracoes() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [webhookStatus, setWebhookStatus] = useState<string>('');
  const [instanceInfo, setInstanceInfo] = useState<any>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const qrTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [qrCountdown, setQrCountdown] = useState(0);

  useEffect(() => {
    carregarConfigs();
    verificarWhatsApp();
    carregarInfoInstancia();

    // Polling de status a cada 5s
    const interval = setInterval(verificarWhatsApp, 5000);
    return () => {
      clearInterval(interval);
      if (pollRef.current) clearInterval(pollRef.current);
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };
  }, []);

  async function carregarConfigs() {
    try {
      const { data } = await api.get('/configuracoes');
      setConfigs(data);
    } catch (error) {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }

  async function carregarInfoInstancia() {
    try {
      const { data } = await api.get('/configuracoes/whatsapp/info');
      if (data.sucesso) setInstanceInfo(data.data);
    } catch (error) {}
  }

  const verificarWhatsApp = useCallback(async () => {
    try {
      const { data } = await api.get('/configuracoes/whatsapp/status');
      setWhatsappStatus(data);

      if (data.conectado) {
        setConnectionState('connected');
        setQrCode(null);
        setQrCountdown(0);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (qrTimerRef.current) {
          clearInterval(qrTimerRef.current);
          qrTimerRef.current = null;
        }
      } else if (connectionState === 'connected') {
        setConnectionState('disconnected');
      }
    } catch (error) {
      setWhatsappStatus({ conectado: false, estado: 'error' });
      setConnectionState('error');
    }
  }, [connectionState]);

  async function conectarWhatsApp() {
    setLoadingQR(true);
    setConnectionState('connecting');
    setQrCode(null);

    try {
      const { data } = await api.post('/configuracoes/whatsapp/conectar');

      if (data.conectado) {
        setConnectionState('connected');
        toast.success('✅ WhatsApp já está conectado!');
        setLoadingQR(false);
        return;
      }

      if (data.sucesso) {
        // WPPConnect: QR Code é obtido via qrcode-session ou webhook
        // Iniciar polling no endpoint GET /whatsapp/qrcode
        if (data.pairingCode) {
          toast.success(`📱 Código de pareamento: ${data.pairingCode}`);
        }
        toast('⏳ Aguardando QR Code via webhook...');
        iniciarPollingQRCode();
        // NÃO chamar iniciarPollingConexao() aqui — usa o mesmo pollRef
        // e sobrescreveria o polling do QR Code. O polling do QR já
        // verifica data.conectado internamente.
      } else {
        toast.error(data.erro || 'Erro ao conectar');
        setConnectionState('error');
      }
    } catch (error) {
      toast.error('Erro ao conectar WhatsApp');
      setConnectionState('error');
    } finally {
      setLoadingQR(false);
    }
  }

  /**
   * Polling do QR Code — busca QR recebido via webhook no backend
   */
  function iniciarPollingQRCode() {
    if (pollRef.current) clearInterval(pollRef.current);
    let tentativas = 0;
    const maxTentativas = 30; // 30 x 2s = 60s

    pollRef.current = setInterval(async () => {
      tentativas++;
      if (tentativas > maxTentativas) {
        if (pollRef.current) clearInterval(pollRef.current);
        toast.error('⏰ Tempo esgotado. Clique em "Conectar" novamente.');
        setConnectionState('disconnected');
        return;
      }

      try {
        const { data } = await api.get('/configuracoes/whatsapp/qrcode');

        if (data.conectado) {
          // Conectou com sucesso!
          setConnectionState('connected');
          setQrCode(null);
          setQrCountdown(0);
          if (pollRef.current) clearInterval(pollRef.current);
          if (qrTimerRef.current) clearInterval(qrTimerRef.current);
          toast.success('✅ WhatsApp conectado com sucesso!');
          await configurarWebhook(true);
          carregarInfoInstancia();
          return;
        }

        if (data.qrCode) {
          // QR Code recebido via webhook!
          const qrSrc = data.qrCode.startsWith('data:') ? data.qrCode : `data:image/png;base64,${data.qrCode}`;
          setQrCode(qrSrc);
          setConnectionState('qr_ready');
          
          if (tentativas <= 2) {
            toast.success('📱 QR Code gerado! Escaneie com o WhatsApp.');
          }
          iniciarContadorQR();
          
          // Continuar polling para detectar conexão
          // Mas não parar o polling do QR - ele continua checando
        } else if (data.expirado) {
          // QR expirou, tentar reconectar
          toast('🔄 QR Code expirou, gerando novo...');
          try {
            await api.post('/configuracoes/whatsapp/conectar');
          } catch (e) {}
        }
      } catch (e) {
        // Ignorar erros de polling silenciosamente
      }
    }, 2000); // Poll a cada 2 segundos
  }

  function iniciarContadorQR() {
    setQrCountdown(60);
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    qrTimerRef.current = setInterval(() => {
      setQrCountdown(prev => {
        if (prev <= 1) {
          if (qrTimerRef.current) clearInterval(qrTimerRef.current);
          // QR expirou — gerar novo automaticamente
          renovarQRCode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function renovarQRCode() {
    try {
      // Reconectar para gerar novo QR via webhook
      await api.post('/configuracoes/whatsapp/conectar');
      toast('🔄 Solicitando novo QR Code...');
      // O polling já está ativo e vai captar o novo QR
      if (!pollRef.current) {
        iniciarPollingQRCode();
      }
    } catch (e) {
      toast.error('Erro ao renovar QR Code');
    }
  }

  function iniciarPollingConexao() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get('/configuracoes/whatsapp/status');
        if (data.conectado) {
          setConnectionState('connected');
          setQrCode(null);
          setQrCountdown(0);
          if (pollRef.current) clearInterval(pollRef.current);
          if (qrTimerRef.current) clearInterval(qrTimerRef.current);
          toast.success('✅ WhatsApp conectado com sucesso!');
          // Auto-configurar webhook
          await configurarWebhook(true);
          carregarInfoInstancia();
        }
      } catch (e) {}
    }, 3000);
  }

  async function desconectarWhatsApp() {
    try {
      await api.post('/configuracoes/whatsapp/desconectar');
      setConnectionState('disconnected');
      setQrCode(null);
      toast.success('WhatsApp desconectado');
    } catch (error) {
      toast.error('Erro ao desconectar');
    }
  }

  async function reiniciarInstancia() {
    try {
      await api.post('/configuracoes/whatsapp/reiniciar');
      setConnectionState('disconnected');
      toast.success('Instância reiniciada');
      setTimeout(verificarWhatsApp, 3000);
    } catch (error) {
      toast.error('Erro ao reiniciar');
    }
  }

  async function configurarWebhook(silent = false) {
    try {
      const { data } = await api.post('/configuracoes/whatsapp/webhook');
      if (data.sucesso) {
        setWebhookStatus(`✅ Webhook ativo: ${data.url || 'configurado'}`);
        if (!silent) toast.success('Webhook configurado!');
      } else {
        setWebhookStatus('❌ Falha ao configurar webhook');
        if (!silent) toast.error(data.erro || 'Erro');
      }
    } catch (error) {
      setWebhookStatus('❌ Erro ao configurar webhook');
      if (!silent) toast.error('Erro ao configurar webhook');
    }
  }

  async function salvarConfig(chave: string, valor: string) {
    try {
      await api.post('/configuracoes', { chave, valor });
      toast.success(`${chave} salvo!`);
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  }

  function exportarLeads() {
    window.open('/api/contatos/exportar/csv', '_blank');
  }

  const stateConfig = {
    disconnected: { color: 'red', icon: WifiOff, label: '🔴 Desconectado', bg: 'bg-red-500/20 border-red-500/30 text-red-300' },
    connecting: { color: 'yellow', icon: Loader2, label: '🟡 Conectando...', bg: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300' },
    qr_ready: { color: 'blue', icon: QrCode, label: '🔵 Aguardando scan do QR Code', bg: 'bg-blue-500/20 border-blue-500/30 text-blue-300' },
    connected: { color: 'green', icon: CheckCircle, label: '🟢 Conectado', bg: 'bg-green-500/20 border-green-500/30 text-green-300' },
    error: { color: 'red', icon: XCircle, label: '🔴 Erro na conexão', bg: 'bg-red-500/20 border-red-500/30 text-red-300' }
  };

  const currentState = stateConfig[connectionState];
  const StateIcon = currentState.icon;

  return (
    <>
      <Head>
        <title>Configurações — Prospecção WhatsApp</title>
      </Head>

      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-white">⚙️ Configurações</h1>

        {/* ============================================ */}
        {/* SEÇÃO 1: CONEXÃO WHATSAPP (PRINCIPAL) */}
        {/* ============================================ */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-400" />
            Conexão WhatsApp
          </h2>

          {/* Status Badge */}
          <div className="flex items-center gap-4 mb-4">
            <div className={`px-4 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 ${currentState.bg}`}>
              <StateIcon className={`w-4 h-4 ${connectionState === 'connecting' ? 'animate-spin' : ''}`} />
              {currentState.label}
            </div>
            {whatsappStatus?.estado && whatsappStatus.estado !== 'unknown' && (
              <span className="text-xs text-slate-400">Estado: {whatsappStatus.estado}</span>
            )}
          </div>

          {/* Instruções passo-a-passo para conectar */}
          {connectionState !== 'connected' && (
            <div className="mb-4 bg-slate-900 rounded-lg p-4 border border-slate-600">
              <h3 className="text-sm font-semibold text-white mb-2">📋 Como conectar:</h3>
              <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                <li>Clique no botão <strong>"Conectar WhatsApp"</strong> abaixo</li>
                <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                <li>Vá em <strong>Menu (⋮)</strong> → <strong>Aparelhos conectados</strong></li>
                <li>Toque em <strong>"Conectar um aparelho"</strong></li>
                <li>Escaneie o <strong>QR Code</strong> que aparecerá abaixo</li>
              </ol>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3 mb-4">
            {connectionState !== 'connected' ? (
              <button
                onClick={conectarWhatsApp}
                disabled={loadingQR}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-green-600/20"
              >
                {loadingQR ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Conectar WhatsApp
              </button>
            ) : (
              <>
                <button
                  onClick={() => configurarWebhook(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Webhook className="w-4 h-4" />
                  Reconfigurar Webhook
                </button>
                <button
                  onClick={desconectarWhatsApp}
                  className="px-4 py-2 bg-red-600/80 hover:bg-red-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Desconectar
                </button>
                <button
                  onClick={reiniciarInstancia}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reiniciar
                </button>
              </>
            )}
          </div>

          {/* Webhook status */}
          {webhookStatus && connectionState === 'connected' && (
            <div className="text-xs text-slate-400 mb-4">{webhookStatus}</div>
          )}

          {/* QR Code Display */}
          {qrCode && connectionState !== 'connected' && (
            <div className="mt-4 flex flex-col items-center gap-4 p-8 bg-white rounded-xl shadow-2xl">
              <div className="relative">
                <img src={qrCode} alt="QR Code WhatsApp" className="w-72 h-72 rounded-lg" />
                {qrCountdown > 0 && qrCountdown <= 15 && (
                  <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg font-bold bg-red-500 px-3 py-1 rounded-full">
                      Expira em {qrCountdown}s
                    </span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-700 font-medium">
                  📱 Escaneie com o WhatsApp do celular
                </p>
                {qrCountdown > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    QR Code expira em <strong>{qrCountdown}s</strong> — renova automaticamente
                  </p>
                )}
              </div>
              <button
                onClick={renovarQRCode}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3 h-3" /> Gerar novo QR Code
              </button>
            </div>
          )}

          {/* Info da instância quando conectado */}
          {connectionState === 'connected' && (
            <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-300 font-semibold">WhatsApp conectado e pronto para enviar mensagens!</span>
              </div>
              <p className="text-sm text-green-200/70">
                O bot está ativo e receberá mensagens automaticamente. Configure suas campanhas na página de Campanhas.
              </p>
              {instanceInfo?.instance && (
                <div className="mt-2 text-xs text-slate-400">
                  Instância: {instanceInfo.instance.instanceName} | 
                  ID: {instanceInfo.instance.instanceId?.substring(0, 8)}...
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* SEÇÃO 2: CONFIGURAÇÕES DA API */}
        {/* ============================================ */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">🔧 WPPConnect-Server</h2>
          <div className="space-y-4">
            {[
              { chave: 'WPPCONNECT_URL', label: 'URL do WPPConnect', placeholder: 'http://localhost:21465' },
              { chave: 'WPPCONNECT_SECRET_KEY', label: 'Secret Key', placeholder: 'prospeccao-secret-2024', type: 'password' },
            ].map((field) => (
              <div key={field.chave} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">{field.label}</label>
                  <input
                    type={field.type || 'text'}
                    value={configs[field.chave] || ''}
                    onChange={(e) => setConfigs({ ...configs, [field.chave]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => salvarConfig(field.chave, configs[field.chave] || '')}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
                >
                  <Save className="w-4 h-4 text-slate-300" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-300">
              Alterações na API URL e Key requerem reiniciar o backend para ter efeito.
              As configurações atuais são carregadas do arquivo <code>.env</code>.
            </p>
          </div>
        </div>

        {/* ============================================ */}
        {/* SEÇÃO 3: TELEGRAM */}
        {/* ============================================ */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">📱 Notificações Telegram</h2>
          <div className="space-y-4">
            {[
              { chave: 'TELEGRAM_BOT_TOKEN', label: 'Bot Token', placeholder: '123456:ABC-DEF...', type: 'password' },
              { chave: 'TELEGRAM_CHAT_ID', label: 'Chat ID', placeholder: '123456789' },
            ].map((field) => (
              <div key={field.chave} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">{field.label}</label>
                  <input
                    type={field.type || 'text'}
                    value={configs[field.chave] || ''}
                    onChange={(e) => setConfigs({ ...configs, [field.chave]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => salvarConfig(field.chave, configs[field.chave] || '')}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
                >
                  <Save className="w-4 h-4 text-slate-300" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300">
              Para criar um bot: fale com @BotFather no Telegram. Para obter o Chat ID: fale com @userinfobot.
              Configure no arquivo <code>.env</code> do backend para que as notificações funcionem.
            </p>
          </div>
        </div>

        {/* ============================================ */}
        {/* SEÇÃO 4: EXPORTAR */}
        {/* ============================================ */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">📥 Exportar Dados</h2>
          <button
            onClick={exportarLeads}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar todos os contatos e leads (CSV)
          </button>
        </div>
      </div>
    </>
  );
}
