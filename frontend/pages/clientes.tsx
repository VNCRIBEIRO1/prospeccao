import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import {
  Users, UserPlus, Search, Package, CheckCircle, XCircle, Clock,
  RefreshCw, ChevronDown, ChevronUp, Edit3, Save, X, Trash2,
  Phone, Building2, MapPin, Briefcase, Eye, ExternalLink,
  FileText, Filter, AlertCircle, Copy, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

interface Contato {
  id: number;
  nome: string;
  telefone: string;
  escritorio?: string;
  cidade?: string;
  areaAtuacao?: string;
  status: string;
}

interface Pedido {
  id: number;
  codigo: string;
  contatoId: number;
  nomeCliente: string;
  escritorio?: string;
  cidade?: string;
  areaAtuacao?: string;
  telefone: string;
  tipo: string;
  status: string;
  materiaisRecebidos?: string;
  aprovado: boolean;
  aprovadoEm?: string;
  notas?: string;
  criadoEm: string;
  atualizadoEm: string;
  contato: Contato;
}

interface Stats {
  novos: number;
  aprovados: number;
  emDesenvolvimento: number;
  concluidos: number;
  cancelados: number;
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string; icon: any }> = {
  novo:                { label: 'Novo',              cor: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', icon: Clock },
  aprovado:            { label: 'Aprovado',          cor: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/30',   icon: CheckCircle },
  em_desenvolvimento:  { label: 'Em Desenvolvimento', cor: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/30', icon: RefreshCw },
  concluido:           { label: 'Concluído',         cor: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/30',  icon: CheckCircle },
  cancelado:           { label: 'Cancelado',         cor: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/30',    icon: XCircle },
};

const TIPO_CONFIG: Record<string, { label: string; icone: string }> = {
  site_chatbot:       { label: 'Site + Chatbot',       icone: '🖥️' },
  personalizado:      { label: 'Personalizado',        icone: '🚀' },
  redesign:           { label: 'Redesign',             icone: '🎨' },
  outros:             { label: 'Outros',               icone: '📋' },
};

export default function Clientes() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [stats, setStats] = useState<Stats>({ novos: 0, aprovados: 0, emDesenvolvimento: 0, concluidos: 0, cancelados: 0 });
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editNotas, setEditNotas] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({
    nomeCliente: '', telefone: '', escritorio: '', cidade: '', areaAtuacao: '', tipo: 'site_chatbot', notas: '',
  });

  const carregarPedidos = useCallback(async () => {
    try {
      const params: any = {};
      if (filtroStatus !== 'todos') params.status = filtroStatus;
      if (busca) params.busca = busca;
      const { data } = await api.get('/pedidos', { params });
      setPedidos(data.pedidos);
      setStats(data.stats);
    } catch {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, busca]);

  useEffect(() => {
    carregarPedidos();
    const interval = setInterval(carregarPedidos, 30000);
    return () => clearInterval(interval);
  }, [carregarPedidos]);

  async function aprovarPedido(id: number) {
    if (!confirm('Aprovar este pedido? O perfil do cliente será criado.')) return;
    try {
      await api.patch(`/pedidos/${id}`, { aprovado: true });
      toast.success('✅ Pedido aprovado! Cliente cadastrado.');
      carregarPedidos();
    } catch {
      toast.error('Erro ao aprovar');
    }
  }

  async function atualizarStatus(id: number, novoStatus: string) {
    try {
      await api.patch(`/pedidos/${id}`, { status: novoStatus });
      toast.success(`Status atualizado para ${STATUS_CONFIG[novoStatus]?.label || novoStatus}`);
      carregarPedidos();
    } catch {
      toast.error('Erro ao atualizar');
    }
  }

  async function salvarNotas(id: number) {
    try {
      await api.patch(`/pedidos/${id}`, { notas: editNotas });
      toast.success('Notas salvas');
      setEditandoId(null);
      carregarPedidos();
    } catch {
      toast.error('Erro ao salvar');
    }
  }

  async function excluirPedido(id: number) {
    if (!confirm('Excluir este pedido?')) return;
    try {
      await api.delete(`/pedidos/${id}`);
      toast.success('Pedido excluído');
      carregarPedidos();
    } catch {
      toast.error('Erro ao excluir');
    }
  }

  async function criarPedidoManual(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nomeCliente || !form.telefone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }
    setFormLoading(true);
    try {
      const { data } = await api.post('/pedidos', form);
      toast.success(`✅ Pedido ${data.codigo} criado!`);
      setShowForm(false);
      setForm({ nomeCliente: '', telefone: '', escritorio: '', cidade: '', areaAtuacao: '', tipo: 'site_chatbot', notas: '' });
      carregarPedidos();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar');
    } finally {
      setFormLoading(false);
    }
  }

  function copiarCodigo(codigo: string) {
    navigator.clipboard.writeText(codigo);
    toast.success(`Código ${codigo} copiado!`);
  }

  function formatarData(data: string) {
    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function tempoDesde(data: string) {
    const diff = Date.now() - new Date(data).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  const totalPedidos = stats.novos + stats.aprovados + stats.emDesenvolvimento + stats.concluidos + stats.cancelados;

  return (
    <>
      <Head>
        <title>Clientes &amp; Pedidos — Prospecção WhatsApp</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-blue-400" />
              Clientes &amp; Pedidos
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Gerencie pedidos, aprove projetos e cadastre clientes
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Novo Pedido
            </button>
            <button
              onClick={carregarPedidos}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Atualizar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Novos', valor: stats.novos, cor: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Clock, filtro: 'novo' },
            { label: 'Aprovados', valor: stats.aprovados, cor: 'text-blue-400', bg: 'bg-blue-400/10', icon: CheckCircle, filtro: 'aprovado' },
            { label: 'Em Dev', valor: stats.emDesenvolvimento, cor: 'text-purple-400', bg: 'bg-purple-400/10', icon: RefreshCw, filtro: 'em_desenvolvimento' },
            { label: 'Concluídos', valor: stats.concluidos, cor: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle, filtro: 'concluido' },
            { label: 'Cancelados', valor: stats.cancelados, cor: 'text-red-400', bg: 'bg-red-400/10', icon: XCircle, filtro: 'cancelado' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.label}
                onClick={() => setFiltroStatus(filtroStatus === card.filtro ? 'todos' : card.filtro)}
                className={`p-4 rounded-xl border transition-all ${
                  filtroStatus === card.filtro ? `${card.bg} border-current ring-1 ring-current/20` : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`w-5 h-5 ${card.cor}`} />
                  <span className={`text-2xl font-bold ${card.cor}`}>{card.valor}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 text-left">{card.label}</p>
              </button>
            );
          })}
        </div>

        {/* Busca */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregarPedidos()}
              placeholder="Buscar por código, nome, telefone, escritório..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none"
            />
          </div>
          {(busca || filtroStatus !== 'todos') && (
            <button
              onClick={() => { setBusca(''); setFiltroStatus('todos'); }}
              className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 rounded-lg"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Lista de Pedidos */}
        {pedidos.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Nenhum pedido encontrado</p>
            <p className="text-sm text-slate-500 mt-1">Pedidos são criados automaticamente pelo bot ou manualmente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pedidos.map((pedido) => {
              const statusConf = STATUS_CONFIG[pedido.status] || STATUS_CONFIG.novo;
              const tipoConf = TIPO_CONFIG[pedido.tipo] || TIPO_CONFIG.outros;
              const StatusIcon = statusConf.icon;
              const isExpanded = expandidoId === pedido.id;

              return (
                <div
                  key={pedido.id}
                  className={`bg-slate-800/50 border rounded-xl overflow-hidden transition-all ${statusConf.bg}`}
                >
                  {/* Header do card */}
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-700/20 transition-colors"
                    onClick={() => setExpandidoId(isExpanded ? null : pedido.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${statusConf.bg}`}>
                          <StatusIcon className={`w-5 h-5 ${statusConf.cor}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={(e) => { e.stopPropagation(); copiarCodigo(pedido.codigo); }}
                              className="px-2 py-0.5 bg-slate-700 rounded text-xs font-mono text-blue-400 hover:bg-slate-600 flex items-center gap-1"
                            >
                              {pedido.codigo} <Copy className="w-3 h-3" />
                            </button>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusConf.bg} ${statusConf.cor}`}>
                              {statusConf.label}
                            </span>
                            <span className="text-xs text-slate-500">
                              {tipoConf.icone} {tipoConf.label}
                            </span>
                          </div>
                          <h3 className="text-white font-medium mt-1 truncate">
                            {pedido.nomeCliente}
                            {pedido.escritorio && <span className="text-slate-400 text-sm ml-2">— {pedido.escritorio}</span>}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-slate-500">{tempoDesde(pedido.criadoEm)} atrás</p>
                          <p className="text-xs text-slate-500">{formatarData(pedido.criadoEm)}</p>
                        </div>
                        {pedido.status === 'novo' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); aprovarPedido(pedido.id); }}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium text-white transition-colors flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                          </button>
                        )}
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo expandido */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-4">
                      {/* Info do contato */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <a href={`https://wa.me/${pedido.telefone}`} target="_blank" rel="noopener noreferrer"
                            className="text-green-400 hover:underline flex items-center gap-1">
                            {pedido.telefone} <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        {pedido.escritorio && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Building2 className="w-4 h-4 text-slate-500" />
                            {pedido.escritorio}
                          </div>
                        )}
                        {pedido.cidade && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <MapPin className="w-4 h-4 text-slate-500" />
                            {pedido.cidade}
                          </div>
                        )}
                        {pedido.areaAtuacao && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Briefcase className="w-4 h-4 text-slate-500" />
                            {pedido.areaAtuacao}
                          </div>
                        )}
                      </div>

                      {/* Aprovação info */}
                      {pedido.aprovado && pedido.aprovadoEm && (
                        <div className="text-xs text-green-400 bg-green-400/10 px-3 py-2 rounded-lg">
                          ✅ Aprovado em {formatarData(pedido.aprovadoEm)}
                        </div>
                      )}

                      {/* Status + Ações */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="text-xs text-slate-400">Status:</label>
                        <select
                          value={pedido.status}
                          onChange={(e) => atualizarStatus(pedido.id, e.target.value)}
                          className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none"
                        >
                          {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                            <option key={key} value={key}>{conf.label}</option>
                          ))}
                        </select>

                        <a
                          href={`https://wa.me/${pedido.telefone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg text-xs hover:bg-green-600/30 transition-colors flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5" /> WhatsApp
                        </a>

                        <button
                          onClick={() => excluirPedido(pedido.id)}
                          className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-xs hover:bg-red-500/20 transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                      </div>

                      {/* Notas */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-slate-400 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> Notas
                          </label>
                          {editandoId === pedido.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => salvarNotas(pedido.id)}
                                className="p-1 text-green-400 hover:bg-green-400/10 rounded">
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditandoId(null)}
                                className="p-1 text-slate-400 hover:bg-slate-600 rounded">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditandoId(pedido.id); setEditNotas(pedido.notas || ''); }}
                              className="p-1 text-slate-400 hover:bg-slate-600 rounded"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {editandoId === pedido.id ? (
                          <textarea
                            value={editNotas}
                            onChange={(e) => setEditNotas(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 resize-none outline-none focus:border-blue-500"
                            rows={3}
                            placeholder="Adicionar notas..."
                          />
                        ) : (
                          <p className="text-sm text-slate-300 bg-slate-700/30 px-3 py-2 rounded-lg min-h-[2rem]">
                            {pedido.notas || <span className="text-slate-500 italic">Sem notas</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Total */}
        <div className="text-center text-sm text-slate-500">
          {pedidos.length} de {totalPedidos} pedidos
        </div>
      </div>

      {/* Modal — Novo Pedido Manual */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" /> Novo Pedido Manual
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={criarPedidoManual} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 mb-1 block">Nome do Cliente *</label>
                  <input
                    value={form.nomeCliente}
                    onChange={(e) => setForm({ ...form, nomeCliente: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none focus:border-blue-500"
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Telefone *</label>
                  <input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none focus:border-blue-500"
                    placeholder="5518999999999"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Escritório</label>
                  <input
                    value={form.escritorio}
                    onChange={(e) => setForm({ ...form, escritorio: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none focus:border-blue-500"
                    placeholder="Nome do escritório"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Cidade</label>
                  <input
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none focus:border-blue-500"
                    placeholder="Cidade/UF"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Área de Atuação</label>
                  <input
                    value={form.areaAtuacao}
                    onChange={(e) => setForm({ ...form, areaAtuacao: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none focus:border-blue-500"
                    placeholder="Trabalhista, Civil..."
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none"
                  >
                    {Object.entries(TIPO_CONFIG).map(([key, conf]) => (
                      <option key={key} value={key}>{conf.icone} {conf.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 resize-none outline-none focus:border-blue-500"
                  rows={3}
                  placeholder="Observações sobre o pedido..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Criar Pedido
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
