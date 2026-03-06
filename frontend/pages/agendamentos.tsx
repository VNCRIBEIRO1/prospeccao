import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import {
  Calendar, Clock, User, Phone, Building2, MapPin, Briefcase,
  CheckCircle, XCircle, AlertCircle, Edit3, Save, X, Trash2,
  Filter, RefreshCw, ChevronDown, ChevronUp, Plus, FileText,
  Send, Eye, MessageSquare
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
  etapaBot: string;
}

interface Agendamento {
  id: number;
  contatoId: number;
  tipo: string;
  status: string;
  resumo?: string;
  notas?: string;
  dataContato?: string;
  prioridade: string;
  criadoEm: string;
  atualizadoEm: string;
  contato: Contato;
}

interface Stats {
  pendentes: number;
  emAndamento: number;
  concluidos: number;
  cancelados: number;
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string; icon: any }> = {
  pendente: { label: 'Pendente', cor: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', icon: Clock },
  em_andamento: { label: 'Em Andamento', cor: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30', icon: RefreshCw },
  concluido: { label: 'Concluído', cor: 'text-green-400', bg: 'bg-green-400/10 border-green-400/30', icon: CheckCircle },
  cancelado: { label: 'Cancelado', cor: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30', icon: XCircle },
};

const TIPO_CONFIG: Record<string, { label: string; icone: string }> = {
  enviar_docs: { label: 'Enviando Documentos', icone: '📤' },
  aguardando_contato: { label: 'Aguardando Contato', icone: '⏳' },
  projeto_personalizado: { label: 'Projeto Personalizado', icone: '🚀' },
  followup: { label: 'Follow-up', icone: '🔄' },
  outros: { label: 'Outros', icone: '📋' },
};

const PRIORIDADE_CONFIG: Record<string, { label: string; cor: string }> = {
  baixa: { label: 'Baixa', cor: 'text-slate-400' },
  normal: { label: 'Normal', cor: 'text-blue-400' },
  alta: { label: 'Alta', cor: 'text-orange-400' },
  urgente: { label: 'Urgente', cor: 'text-red-400' },
};

export default function Agendamentos() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [stats, setStats] = useState<Stats>({ pendentes: 0, emAndamento: 0, concluidos: 0, cancelados: 0 });
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editNotas, setEditNotas] = useState('');
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

  const carregarAgendamentos = useCallback(async () => {
    try {
      const params: any = {};
      if (filtroStatus !== 'todos') params.status = filtroStatus;
      if (filtroTipo !== 'todos') params.tipo = filtroTipo;

      const { data } = await api.get('/agendamentos', { params });
      setAgendamentos(data.agendamentos);
      setStats(data.stats);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, filtroTipo]);

  useEffect(() => {
    carregarAgendamentos();
    const interval = setInterval(carregarAgendamentos, 30000);
    return () => clearInterval(interval);
  }, [carregarAgendamentos]);

  async function atualizarStatus(id: number, novoStatus: string) {
    try {
      await api.patch(`/agendamentos/${id}`, { status: novoStatus });
      toast.success(`Status atualizado para ${STATUS_CONFIG[novoStatus]?.label || novoStatus}`);
      carregarAgendamentos();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  }

  async function atualizarPrioridade(id: number, novaPrioridade: string) {
    try {
      await api.patch(`/agendamentos/${id}`, { prioridade: novaPrioridade });
      toast.success('Prioridade atualizada');
      carregarAgendamentos();
    } catch {
      toast.error('Erro ao atualizar prioridade');
    }
  }

  async function salvarNotas(id: number) {
    try {
      await api.patch(`/agendamentos/${id}`, { notas: editNotas });
      toast.success('Notas salvas');
      setEditandoId(null);
      carregarAgendamentos();
    } catch {
      toast.error('Erro ao salvar notas');
    }
  }

  async function excluirAgendamento(id: number) {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;
    try {
      await api.delete(`/agendamentos/${id}`);
      toast.success('Agendamento excluído');
      carregarAgendamentos();
    } catch {
      toast.error('Erro ao excluir');
    }
  }

  function formatarData(data: string) {
    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function tempoDesde(data: string) {
    const diff = Date.now() - new Date(data).getTime();
    const minutos = Math.floor(diff / 60000);
    if (minutos < 60) return `${minutos}min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `${horas}h`;
    const dias = Math.floor(horas / 24);
    return `${dias}d`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Agendamentos — Prospecção WhatsApp</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-7 h-7 text-blue-400" />
              Agendamentos
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Gerencie contatos que finalizaram com interesse
            </p>
          </div>
          <button
            onClick={carregarAgendamentos}
            className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pendentes', valor: stats.pendentes, cor: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Clock },
            { label: 'Em Andamento', valor: stats.emAndamento, cor: 'text-blue-400', bg: 'bg-blue-400/10', icon: RefreshCw },
            { label: 'Concluídos', valor: stats.concluidos, cor: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle },
            { label: 'Cancelados', valor: stats.cancelados, cor: 'text-red-400', bg: 'bg-red-400/10', icon: XCircle },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-colors cursor-pointer"
                onClick={() => setFiltroStatus(
                  card.label === 'Pendentes' ? 'pendente' :
                  card.label === 'Em Andamento' ? 'em_andamento' :
                  card.label === 'Concluídos' ? 'concluido' : 'cancelado'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase">{card.label}</span>
                  <div className={`p-1.5 rounded-lg ${card.bg}`}>
                    <Icon className={`w-4 h-4 ${card.cor}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${card.cor}`}>{card.valor}</p>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Filtros:</span>
          </div>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos Status</option>
            <option value="pendente">🟡 Pendente</option>
            <option value="em_andamento">🔵 Em Andamento</option>
            <option value="concluido">🟢 Concluído</option>
            <option value="cancelado">🔴 Cancelado</option>
          </select>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos Tipos</option>
            <option value="enviar_docs">📤 Enviando Docs</option>
            <option value="aguardando_contato">⏳ Aguardando Contato</option>
            <option value="projeto_personalizado">🚀 Projeto Personalizado</option>
          </select>

          {(filtroStatus !== 'todos' || filtroTipo !== 'todos') && (
            <button
              onClick={() => { setFiltroStatus('todos'); setFiltroTipo('todos'); }}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Lista de agendamentos */}
        {agendamentos.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-400 mb-2">Nenhum agendamento encontrado</h3>
            <p className="text-sm text-slate-500">
              Agendamentos são criados automaticamente quando leads finalizam o fluxo com interesse.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {agendamentos.map((ag) => {
              const statusConfig = STATUS_CONFIG[ag.status] || STATUS_CONFIG.pendente;
              const tipoConfig = TIPO_CONFIG[ag.tipo] || TIPO_CONFIG.outros;
              const prioConfig = PRIORIDADE_CONFIG[ag.prioridade] || PRIORIDADE_CONFIG.normal;
              const StatusIcon = statusConfig.icon;
              const isExpanded = expandidoId === ag.id;
              const isEditing = editandoId === ag.id;

              return (
                <div
                  key={ag.id}
                  className={`bg-slate-800 rounded-xl border ${statusConfig.bg} transition-all hover:border-opacity-60`}
                >
                  {/* Linha principal */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandidoId(isExpanded ? null : ag.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Status icon */}
                        <div className={`p-2 rounded-lg ${statusConfig.bg.split(' ')[0]}`}>
                          <StatusIcon className={`w-5 h-5 ${statusConfig.cor}`} />
                        </div>

                        {/* Info principal */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white truncate">
                              {ag.contato.escritorio || ag.contato.nome}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                              {tipoConfig.icone} {tipoConfig.label}
                            </span>
                            <span className={`text-xs font-medium ${prioConfig.cor}`}>
                              ● {prioConfig.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {ag.contato.nome}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {ag.contato.telefone}
                            </span>
                            {ag.contato.cidade && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {ag.contato.cidade}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {tempoDesde(ag.criadoEm)} atrás
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ações rápidas */}
                      <div className="flex items-center gap-2 ml-4">
                        {ag.status === 'pendente' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); atualizarStatus(ag.id, 'em_andamento'); }}
                            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"
                          >
                            Iniciar
                          </button>
                        )}
                        {ag.status === 'em_andamento' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); atualizarStatus(ag.id, 'concluido'); }}
                            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 rounded-lg text-white transition-colors"
                          >
                            Concluir
                          </button>
                        )}
                        <a
                          href={`https://wa.me/${ag.contato.telefone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 transition-colors"
                          title="Abrir WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4 text-green-400" />
                        </a>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-4">
                      {/* Info do contato */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1">
                            <User className="w-4 h-4" /> Dados do Contato
                          </h4>
                          <div className="text-sm text-slate-400 space-y-1">
                            <p><span className="text-slate-500">Nome:</span> {ag.contato.nome}</p>
                            <p><span className="text-slate-500">Escritório:</span> {ag.contato.escritorio || 'Não informado'}</p>
                            <p><span className="text-slate-500">Telefone:</span> {ag.contato.telefone}</p>
                            <p><span className="text-slate-500">Cidade:</span> {ag.contato.cidade || 'Não informada'}</p>
                            <p><span className="text-slate-500">Área:</span> {ag.contato.areaAtuacao || 'Não informada'}</p>
                            <p><span className="text-slate-500">Status Bot:</span> {ag.contato.etapaBot}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1">
                            <FileText className="w-4 h-4" /> Detalhes do Agendamento
                          </h4>
                          <div className="text-sm text-slate-400 space-y-1">
                            <p><span className="text-slate-500">Criado em:</span> {formatarData(ag.criadoEm)}</p>
                            <p><span className="text-slate-500">Atualizado:</span> {formatarData(ag.atualizadoEm)}</p>
                            {ag.resumo && <p><span className="text-slate-500">Resumo:</span> {ag.resumo}</p>}
                          </div>
                        </div>
                      </div>

                      {/* Notas editáveis */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1">
                            <Edit3 className="w-4 h-4" /> Notas
                          </h4>
                          {!isEditing ? (
                            <button
                              onClick={() => { setEditandoId(ag.id); setEditNotas(ag.notas || ''); }}
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" /> Editar
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => salvarNotas(ag.id)}
                                className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                              >
                                <Save className="w-3 h-3" /> Salvar
                              </button>
                              <button
                                onClick={() => setEditandoId(null)}
                                className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                          <textarea
                            value={editNotas}
                            onChange={(e) => setEditNotas(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-slate-300 focus:outline-none focus:border-blue-500 resize-none"
                            placeholder="Adicione notas sobre o andamento..."
                          />
                        ) : (
                          <p className="text-sm text-slate-400 bg-slate-900/50 rounded-lg p-3">
                            {ag.notas || 'Sem notas'}
                          </p>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/50">
                        {/* Status */}
                        <select
                          value={ag.status}
                          onChange={(e) => atualizarStatus(ag.id, e.target.value)}
                          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="pendente">🟡 Pendente</option>
                          <option value="em_andamento">🔵 Em Andamento</option>
                          <option value="concluido">🟢 Concluído</option>
                          <option value="cancelado">🔴 Cancelado</option>
                        </select>

                        {/* Prioridade */}
                        <select
                          value={ag.prioridade}
                          onChange={(e) => atualizarPrioridade(ag.id, e.target.value)}
                          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="baixa">Prioridade: Baixa</option>
                          <option value="normal">Prioridade: Normal</option>
                          <option value="alta">Prioridade: Alta</option>
                          <option value="urgente">Prioridade: Urgente</option>
                        </select>

                        {/* WhatsApp */}
                        <a
                          href={`https://wa.me/${ag.contato.telefone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 rounded-lg text-white transition-colors flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> WhatsApp
                        </a>

                        {/* Excluir */}
                        <button
                          onClick={() => excluirAgendamento(ag.id)}
                          className="px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 rounded-lg text-red-400 transition-colors flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="w-3 h-3" /> Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
