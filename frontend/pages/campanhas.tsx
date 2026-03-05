import { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  Rocket, Plus, Play, Pause, Trash2, ChevronRight, ChevronLeft, Check,
  MessageSquare, Users, Clock, Gauge, Eye, X, Save, Zap, BarChart3, Send, Edit3, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

interface Campanha {
  id: number; nome: string; status: string;
  delaySegundos: number; limiteDiario: number;
  totalEnviado: number; enviadosHoje: number;
  criadoEm: string; _count?: { leads: number };
}

interface Template {
  id: string; nome: string; conteudo: string; preview: string;
}

const STATUS_COR: Record<string, string> = {
  pausada:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  ativa:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  concluida:'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

const STATUS_ICON: Record<string, string> = {
  pausada: '⏸️', ativa: '🟢', concluida: '✅',
};

export default function Campanhas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nome: '', delaySegundos: 30, limiteDiario: 50 });
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editText, setEditText] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [stats, setStats] = useState({ pendentes: 0, total: 0 });

  useEffect(() => { carregarDados(); }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const { data: campData } = await api.get('/campanhas');
      setCampanhas(campData);
    } catch { toast.error('Erro ao carregar campanhas'); }
    // Templates separado para não bloquear campanhas
    await carregarTemplates();
    // Stats via endpoint otimizado
    try {
      const { data: statsData } = await api.get('/contatos/stats');
      setStats({ pendentes: statsData.pendente || 0, total: statsData.total || 0 });
    } catch { }
    setLoading(false);
  }

  async function carregarTemplates() {
    try {
      const { data } = await api.get('/mensagens/templates');
      if (Array.isArray(data) && data.length > 0) {
        setTemplates(data);
      }
    } catch (err) {
      console.error('Falha ao carregar templates:', err);
    }
  }

  async function criarCampanha() {
    try {
      await api.post('/campanhas', form);
      toast.success('🚀 Campanha criada com sucesso!');
      setShowWizard(false); setStep(1);
      setForm({ nome: '', delaySegundos: 30, limiteDiario: 50 });
      carregarDados();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Erro ao criar campanha';
      toast.error(msg);
    }
  }

  async function iniciarCampanha(id: number) {
    try { await api.post(`/campanhas/${id}/iniciar`); toast.success('Campanha iniciada!'); carregarDados(); }
    catch { toast.error('Erro ao iniciar'); }
  }

  async function pausarCampanha(id: number) {
    try { await api.post(`/campanhas/${id}/pausar`); toast.success('Campanha pausada'); carregarDados(); }
    catch { toast.error('Erro ao pausar'); }
  }

  async function excluirCampanha(id: number) {
    if (!confirm('Excluir esta campanha?')) return;
    try { await api.delete(`/campanhas/${id}`); toast.success('Excluída'); carregarDados(); }
    catch { toast.error('Erro'); }
  }

  async function salvarTemplate() {
    if (!editingTemplate) return;
    try {
      await api.put(`/mensagens/templates/${editingTemplate.id}`, { conteudo: editText });
      toast.success('Mensagem atualizada!');
      setEditingTemplate(null); carregarDados();
    } catch { toast.error('Erro ao salvar'); }
  }

  function WizardStep1() {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-700">
          <div className="w-10 h-10 bg-blue-600/30 rounded-full flex items-center justify-center text-xl">1</div>
          <div><h3 className="text-white font-semibold">Defina a Campanha</h3><p className="text-xs text-slate-400">Nome e configurações de envio</p></div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Nome da Campanha *</label>
          <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Prospecção Advogados SP - Março" maxLength={80}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Clock className="w-3 h-3" /> Intervalo entre mensagens</label>
            <div className="flex items-center gap-3">
              <input type="range" min={10} max={120} value={form.delaySegundos} onChange={e => setForm({ ...form, delaySegundos: +e.target.value })} className="flex-1 accent-blue-500" />
              <span className="text-lg font-bold text-white w-14 text-right">{form.delaySegundos}s</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Tempo entre cada mensagem para evitar bloqueio</p>
          </div>
          <div>
            <label className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Gauge className="w-3 h-3" /> Limite diário</label>
            <div className="flex items-center gap-3">
              <input type="range" min={5} max={200} step={5} value={form.limiteDiario} onChange={e => setForm({ ...form, limiteDiario: +e.target.value })} className="flex-1 accent-blue-500" />
              <span className="text-lg font-bold text-white w-14 text-right">{form.limiteDiario}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Máximo de mensagens por dia</p>
          </div>
        </div>
      </div>
    );
  }

  function WizardStep2() {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-700">
          <div className="w-10 h-10 bg-blue-600/30 rounded-full flex items-center justify-center text-xl">2</div>
          <div><h3 className="text-white font-semibold">Revise as Mensagens</h3><p className="text-xs text-slate-400">Personalize os templates do bot de prospecção</p></div>
        </div>
        {templates.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-500" />
            Templates não disponíveis. Reinicie o backend para carregar.
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {templates.map(t => (
              <div key={t.id} className="bg-slate-900/60 rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />{t.nome}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => setPreviewTemplate(t)} className="p-1.5 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-700" title="Visualizar"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => { setEditingTemplate(t); setEditText(t.conteudo); }} className="p-1.5 text-slate-400 hover:text-yellow-400 rounded hover:bg-slate-700" title="Editar"><Edit3 className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="text-sm text-slate-300 line-clamp-2">{t.preview}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function WizardStep3() {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-700">
          <div className="w-10 h-10 bg-emerald-600/30 rounded-full flex items-center justify-center text-xl">3</div>
          <div><h3 className="text-white font-semibold">Revisar e Criar</h3><p className="text-xs text-slate-400">Confira os detalhes antes de criar a campanha</p></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-1">Nome</p>
            <p className="text-white font-medium">{form.nome || '(sem nome)'}</p>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-1">Intervalo</p>
            <p className="text-white font-medium">{form.delaySegundos}s entre mensagens</p>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-1">Limite diário</p>
            <p className="text-white font-medium">{form.limiteDiario} mensagens/dia</p>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-1">Contatos pendentes</p>
            <p className="text-white font-medium">{stats.pendentes} de {stats.total}</p>
          </div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex gap-3">
          <Zap className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200/80">
            <p className="font-semibold text-blue-200 mb-1">Como funciona:</p>
            <ol className="space-y-1 text-xs list-decimal list-inside">
              <li>A campanha enviará a <b>mensagem inicial</b> para cada contato com status <b>&quot;pendente&quot;</b></li>
              <li>Quando o contato responder, o <b>bot inteligente</b> continuará a conversa automaticamente</li>
              <li>Contatos que demonstram interesse serão marcados como <b>leads qualificados</b></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>Campanhas — Prospecção</title></Head>
      <div className="space-y-5">

        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Rocket className="w-6 h-6 text-blue-400" /> Campanhas</h1>
            <p className="text-sm text-slate-400 mt-0.5">Crie e gerencie campanhas de prospecção via WhatsApp</p>
          </div>
          <button onClick={() => { carregarTemplates(); setShowWizard(true); setStep(1); setForm({ nome:'', delaySegundos: 30, limiteDiario: 50 }); }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Nova Campanha
          </button>
        </div>

        {/* ─── Estado vazio ─── */}
        {campanhas.length === 0 && !loading && (
          <div className="bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-600 p-10 text-center">
            <Rocket className="w-14 h-14 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Crie sua primeira campanha</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Uma campanha envia mensagens automáticas para seus contatos com status &quot;pendente&quot;.
              O bot inteligente cuidará das respostas.
            </p>
            <div className="flex flex-col items-center gap-3">
              <button onClick={() => { carregarTemplates(); setShowWizard(true); setStep(1); }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium flex items-center gap-2">
                <Zap className="w-5 h-5" /> Criar Campanha
              </button>
              <p className="text-xs text-slate-500">💡 Antes, certifique-se de ter contatos importados na aba Contatos</p>
            </div>
          </div>
        )}

        {/* ─── Lista de Campanhas ─── */}
        {campanhas.length > 0 && (
          <div className="grid gap-4">
            {campanhas.map(c => {
              const corStatus = STATUS_COR[c.status] || STATUS_COR.rascunho;
              const icon = STATUS_ICON[c.status] || '📝';
              return (
                <div key={c.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white truncate">{c.nome}</h3>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${corStatus}`}>{icon} {c.status}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1"><Send className="w-3 h-3" /> {c.totalEnviado} enviadas</span>
                        <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {c.enviadosHoje} hoje</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Delay: {c.delaySegundos}s</span>
                        <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> Limite: {c.limiteDiario}/dia</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.totalEnviado > 0 ? Math.round((c.enviadosHoje / Math.max(c.totalEnviado, 1)) * 100) : 0}% hoje</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {(c.status === 'rascunho' || c.status === 'pausada') && (
                        <button onClick={() => iniciarCampanha(c.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                          <Play className="w-4 h-4" /> Iniciar
                        </button>
                      )}
                      {c.status === 'ativa' && (
                        <button onClick={() => pausarCampanha(c.id)}
                          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                          <Pause className="w-4 h-4" /> Pausar
                        </button>
                      )}
                      <button onClick={() => excluirCampanha(c.id)}
                        className="px-3 py-2 bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 rounded-lg text-sm text-red-300 flex items-center gap-1 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Barra de progresso visual */}
                  {c.status === 'ativa' && c.limiteDiario > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Progresso hoje</span>
                        <span>{c.enviadosHoje}/{c.limiteDiario}</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (c.enviadosHoje / c.limiteDiario) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Seção de Templates ─── */}
        {!showWizard && templates.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-blue-400" /> Mensagens do Bot</h2>
            <p className="text-sm text-slate-400 mb-4">Personalize as mensagens que o bot envia automaticamente durante a prospecção.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {templates.map(t => (
                <div key={t.id} className="bg-slate-800 rounded-xl border border-slate-700/50 p-4 hover:border-slate-600 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">{t.nome}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setPreviewTemplate(t)} className="p-1.5 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-700"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setEditingTemplate(t); setEditText(t.conteudo); }} className="p-1.5 text-slate-400 hover:text-yellow-400 rounded hover:bg-slate-700"><Edit3 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{t.preview}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modal Wizard ─── */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowWizard(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Progress */}
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-white">Nova Campanha</h2>
                <button onClick={() => setShowWizard(false)} className="p-1.5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex gap-1">
                {[1,2,3].map(s => (
                  <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-blue-500' : 'bg-slate-700'}`} />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                <span className={step >= 1 ? 'text-blue-400' : ''}>Configurar</span>
                <span className={step >= 2 ? 'text-blue-400' : ''}>Mensagens</span>
                <span className={step >= 3 ? 'text-blue-400' : ''}>Confirmar</span>
              </div>
            </div>
            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {step === 1 && <WizardStep1 />}
              {step === 2 && <WizardStep2 />}
              {step === 3 && <WizardStep3 />}
            </div>
            {/* Footer */}
            <div className="p-4 border-t border-slate-700 flex justify-between">
              {step > 1 ? (
                <button onClick={() => setStep(step - 1)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Voltar</button>
              ) : <div />}
              {step < 3 ? (
                <button onClick={() => { if (step === 1 && !form.nome) { toast.error('Dê um nome à campanha'); return; } setStep(step + 1); }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-1">
                  Próximo <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={criarCampanha} disabled={!form.nome}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-40">
                  <Check className="w-4 h-4" /> Criar Campanha
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Preview Template ─── */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewTemplate(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2"><Eye className="w-4 h-4 text-blue-400" />{previewTemplate.nome}</h3>
              <button onClick={() => setPreviewTemplate(null)} className="p-1.5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-2xl rounded-bl-sm p-4">
                <p className="text-sm text-emerald-100 whitespace-pre-wrap">{previewTemplate.conteudo}</p>
              </div>
              <p className="text-[10px] text-slate-500 mt-3 text-center">
                Variáveis como {'{nome}'} e {'{escritorio}'} serão substituídas pelos dados do contato
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Editar Template ─── */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingTemplate(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2"><Edit3 className="w-4 h-4 text-yellow-400" /> Editar: {editingTemplate.nome}</h3>
              <button onClick={() => setEditingTemplate(null)} className="p-1.5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-400">Use {'{nome}'}, {'{escritorio}'}, {'{cidade}'}, {'{area}'} para personalizar</p>
              <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={10}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-sm text-white font-mono resize-y focus:border-blue-500 focus:outline-none" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingTemplate(null)} className="px-4 py-2 bg-slate-700 rounded-lg text-sm">Cancelar</button>
                <button onClick={salvarTemplate} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-1.5"><Save className="w-4 h-4" /> Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
