import { useState, useEffect } from 'react';
import Head from 'next/head';
import { ExternalLink, MessageSquare, GripVertical, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

interface Lead {
  id: number;
  contatoId: number;
  estagio: string;
  notas: string | null;
  criadoEm: string;
  contato: {
    id: number;
    nome: string;
    telefone: string;
    escritorio: string | null;
    cidade: string | null;
    areaAtuacao: string | null;
    _count?: { mensagens: number };
  };
}

const ESTAGIOS = [
  { id: 'novo', label: 'Novo', cor: 'border-blue-500', bg: 'bg-blue-500/10' },
  { id: 'interessado', label: 'Interessado', cor: 'border-orange-500', bg: 'bg-orange-500/10' },
  { id: 'negociando', label: 'Negociando', cor: 'border-purple-500', bg: 'bg-purple-500/10' },
  { id: 'fechado', label: 'Fechado', cor: 'border-emerald-500', bg: 'bg-emerald-500/10' },
];

export default function Leads() {
  const [kanban, setKanban] = useState<Record<string, Lead[]>>({
    novo: [],
    interessado: [],
    negociando: [],
    fechado: [],
  });
  const [loading, setLoading] = useState(true);
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);

  useEffect(() => {
    carregarLeads();
  }, []);

  async function carregarLeads() {
    try {
      const { data } = await api.get('/leads');
      setKanban(data.kanban);
    } catch (error) {
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  }

  async function moverLead(leadId: number, novoEstagio: string) {
    try {
      await api.patch(`/leads/${leadId}`, { estagio: novoEstagio });
      toast.success(`Lead movido para ${novoEstagio}`);
      carregarLeads();
    } catch (error) {
      toast.error('Erro ao mover lead');
    }
  }

  async function abrirDetalhes(lead: Lead) {
    setLeadSelecionado(lead);
    try {
      const { data } = await api.get(`/mensagens/contato/${lead.contatoId}`);
      setMensagens(data);
    } catch (error) {
      setMensagens([]);
    }
  }

  function abrirWhatsApp(telefone: string) {
    const num = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/${num}`, '_blank');
  }

  function tempoRelativo(data: string) {
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
        <title>Leads — Prospecção WhatsApp</title>
      </Head>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Pipeline de Leads</h1>
          <button
            onClick={carregarLeads}
            className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
          >
            Atualizar
          </button>
        </div>

        {/* Kanban */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ESTAGIOS.map((estagio) => (
            <div key={estagio.id} className={`rounded-xl border-t-2 ${estagio.cor} bg-slate-800 border border-slate-700`}>
              <div className="p-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{estagio.label}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${estagio.bg} text-white`}>
                    {kanban[estagio.id]?.length || 0}
                  </span>
                </div>
              </div>

              <div className="p-3 space-y-3 min-h-[200px] max-h-[600px] overflow-y-auto">
                {kanban[estagio.id]?.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-slate-900 rounded-lg border border-slate-700 p-4 hover:border-slate-500 transition-colors cursor-pointer group"
                    onClick={() => abrirDetalhes(lead)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{lead.contato.nome}</p>
                          <p className="text-xs text-slate-400">{lead.contato.escritorio || 'Sem escritório'}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">{tempoRelativo(lead.criadoEm)}</span>
                    </div>

                    {lead.contato.cidade && (
                      <p className="text-xs text-slate-400 mb-1">📍 {lead.contato.cidade}</p>
                    )}
                    {lead.contato.areaAtuacao && (
                      <p className="text-xs text-slate-400 mb-2">⚖️ {lead.contato.areaAtuacao}</p>
                    )}

                    <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      {ESTAGIOS.filter(e => e.id !== estagio.id).map(e => (
                        <button
                          key={e.id}
                          onClick={(ev) => { ev.stopPropagation(); moverLead(lead.id, e.id); }}
                          className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                        >
                          → {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {(!kanban[estagio.id] || kanban[estagio.id].length === 0) && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Nenhum lead
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal de detalhes */}
        {leadSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setLeadSelecionado(null)}>
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">{leadSelecionado.contato.nome}</h2>
                    <p className="text-sm text-slate-400">
                      {leadSelecionado.contato.escritorio} • {leadSelecionado.contato.cidade}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirWhatsApp(leadSelecionado.contato.telefone)}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Abrir WhatsApp
                    </button>
                    <button
                      onClick={() => setLeadSelecionado(null)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Histórico de Mensagens
                </h3>
                <div className="space-y-3">
                  {mensagens.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direcao === 'enviada' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 text-sm ${
                          msg.direcao === 'enviada'
                            ? 'bg-blue-600/20 border border-blue-600/30 text-blue-100'
                            : 'bg-slate-700 border border-slate-600 text-slate-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-xs">{msg.conteudo?.substring(0, 300)}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(msg.criadoEm).toLocaleString('pt-BR')}
                          {msg.etapa && ` • ${msg.etapa}`}
                        </p>
                      </div>
                    </div>
                  ))}
                  {mensagens.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhuma mensagem registrada</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
