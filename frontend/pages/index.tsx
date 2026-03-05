import { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  Users, Send, MessageSquare, Target, CheckCircle, XCircle,
  TrendingUp, Activity
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import api from '../lib/api';

interface Metricas {
  totalContatos: number;
  disparadosHoje: number;
  taxaResposta: number;
  totalInteressados: number;
  totalFechados: number;
  totalNaoInteresse: number;
  whatsapp: { conectado: boolean; estado: string };
  grafico: { data: string; enviadas: number; recebidas: number }[];
  fila: { ativo: boolean; aguardando: number; ativos: number; atrasados: number };
  leadsKanban: Record<string, number>;
}

export default function Dashboard() {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarMetricas();
    const interval = setInterval(carregarMetricas, 15000);
    return () => clearInterval(interval);
  }, []);

  async function carregarMetricas() {
    try {
      const { data } = await api.get('/metricas');
      setMetricas(data);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  const cards = [
    {
      titulo: 'Total Contatos',
      valor: metricas?.totalContatos || 0,
      icon: Users,
      cor: 'text-blue-400',
      bg: 'bg-blue-400/10'
    },
    {
      titulo: 'Disparados Hoje',
      valor: metricas?.disparadosHoje || 0,
      icon: Send,
      cor: 'text-purple-400',
      bg: 'bg-purple-400/10'
    },
    {
      titulo: 'Taxa de Resposta',
      valor: `${metricas?.taxaResposta || 0}%`,
      icon: MessageSquare,
      cor: 'text-green-400',
      bg: 'bg-green-400/10'
    },
    {
      titulo: 'Leads Qualificados',
      valor: metricas?.totalInteressados || 0,
      icon: Target,
      cor: 'text-orange-400',
      bg: 'bg-orange-400/10'
    },
    {
      titulo: 'Conversões',
      valor: metricas?.totalFechados || 0,
      icon: CheckCircle,
      cor: 'text-emerald-400',
      bg: 'bg-emerald-400/10'
    },
    {
      titulo: 'WhatsApp',
      valor: metricas?.whatsapp?.conectado ? 'Online' : 'Offline',
      icon: metricas?.whatsapp?.conectado ? Activity : XCircle,
      cor: metricas?.whatsapp?.conectado ? 'text-green-400' : 'text-red-400',
      bg: metricas?.whatsapp?.conectado ? 'bg-green-400/10' : 'bg-red-400/10'
    },
  ];

  return (
    <>
      <Head>
        <title>Dashboard — Prospecção WhatsApp</title>
      </Head>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <button
            onClick={carregarMetricas}
            className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
          >
            Atualizar
          </button>
        </div>

        {/* Cards de métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.titulo}
                className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {card.titulo}
                  </span>
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <Icon className={`w-4 h-4 ${card.cor}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${card.cor}`}>{card.valor}</p>
              </div>
            );
          })}
        </div>

        {/* Gráfico */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Disparos vs Respostas — Últimos 7 dias</h2>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metricas?.grafico || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="data"
                stroke="#64748b"
                fontSize={12}
                tickFormatter={(v) => {
                  const d = new Date(v + 'T12:00:00');
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="enviadas"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Enviadas"
                dot={{ fill: '#3b82f6', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="recebidas"
                stroke="#10b981"
                strokeWidth={2}
                name="Respostas"
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Fila de disparos */}
        {metricas?.fila?.ativo && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">📨 Fila de Disparos</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Aguardando', valor: metricas.fila.aguardando, cor: 'text-yellow-400' },
                { label: 'Ativos', valor: metricas.fila.ativos, cor: 'text-blue-400' },
                { label: 'Atrasados', valor: metricas.fila.atrasados, cor: 'text-purple-400' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className={`text-xl font-bold ${item.cor}`}>{item.valor}</p>
                  <p className="text-xs text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
