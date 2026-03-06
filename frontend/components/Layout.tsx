import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard, Users, Megaphone, Target, Settings,
  Menu, X, MessageSquare, Wifi, WifiOff, Calendar, Bell, Package
} from 'lucide-react';
import { useEffect } from 'react';
import api from '../lib/api';

interface LayoutProps {
  children: ReactNode;
}

interface NotificacaoItem {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  criadoEm: string;
}

const menuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contatos', label: 'Contatos', icon: Users },
  { href: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { href: '/mensagens', label: 'Mensagens', icon: MessageSquare },
  { href: '/leads', label: 'Leads', icon: Target },
  { href: '/agendamentos', label: 'Agendamentos', icon: Calendar },
  { href: '/clientes', label: 'Clientes', icon: Package },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [whatsappConectado, setWhatsappConectado] = useState(false);
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [showNotificacoes, setShowNotificacoes] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data } = await api.get('/configuracoes/whatsapp/status');
        setWhatsappConectado(data.conectado);
      } catch {
        setWhatsappConectado(false);
      }
    };
    const checkNotificacoes = async () => {
      try {
        const { data } = await api.get('/notificacoes', { params: { limit: 10 } });
        setNotificacoes(data.notificacoes || []);
        setNaoLidas(data.naoLidas || 0);
      } catch {}
    };
    checkConnection();
    checkNotificacoes();
    const interval = setInterval(checkConnection, 30000);
    const intervalNotif = setInterval(checkNotificacoes, 15000);
    return () => { clearInterval(interval); clearInterval(intervalNotif); };
  }, []);

  async function marcarTodasLidas() {
    try {
      await api.patch('/notificacoes', { marcarTodas: true });
      setNaoLidas(0);
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    } catch {}
  }

  function formatarTempoNotif(data: string) {
    const diff = Date.now() - new Date(data).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 border-r border-slate-700 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-400" />
            <h1 className="text-lg font-bold text-white">Prospecção</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = router.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Status WhatsApp */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/50">
            {whatsappConectado ? (
              <>
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400 font-medium">WhatsApp Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400 font-medium">WhatsApp Desconectado</span>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(true)} className="text-slate-400 lg:hidden">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="ml-4 text-lg font-bold text-white lg:hidden">Prospecção</h1>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotificacoes(!showNotificacoes)}
              className="relative p-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Bell className="w-5 h-5 text-slate-400" />
              {naoLidas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse">
                  {naoLidas > 9 ? '9+' : naoLidas}
                </span>
              )}
            </button>

            {/* Dropdown de notificações */}
            {showNotificacoes && (
              <div className="absolute right-0 top-12 w-80 md:w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-[70vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-400" />
                    Notificações
                    {naoLidas > 0 && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{naoLidas} novas</span>
                    )}
                  </h3>
                  <div className="flex gap-2">
                    {naoLidas > 0 && (
                      <button onClick={marcarTodasLidas} className="text-xs text-blue-400 hover:text-blue-300">
                        Marcar lidas
                      </button>
                    )}
                    <button onClick={() => setShowNotificacoes(false)} className="text-slate-400 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1">
                  {notificacoes.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">
                      Nenhuma notificação
                    </div>
                  ) : (
                    notificacoes.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer ${
                          !n.lida ? 'bg-blue-500/5 border-l-2 border-l-blue-400' : ''
                        }`}
                        onClick={() => {
                          if (n.tipo.includes('agendamento')) {
                            router.push('/agendamentos');
                            setShowNotificacoes(false);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{n.titulo}</p>
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.mensagem}</p>
                          </div>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap mt-0.5">{formatarTempoNotif(n.criadoEm)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {notificacoes.length > 0 && (
                  <div className="px-4 py-2 border-t border-slate-700 text-center">
                    <Link
                      href="/agendamentos"
                      className="text-xs text-blue-400 hover:text-blue-300"
                      onClick={() => setShowNotificacoes(false)}
                    >
                      Ver todos os agendamentos →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
