import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import {
  Search, Upload, Download, Trash2, Edit, Plus,
  ChevronLeft, ChevronRight, Check, X, UserPlus, FileSpreadsheet,
  Phone, Building2, MapPin, Briefcase, CheckCircle2, Users, Eye,
  Send, Loader2, MessageCircle, ExternalLink, Bell, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const STATUS_INFO: Record<string, { label: string; cor: string; icon: string }> = {
  pendente:               { label: 'Aguardando envio', cor: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: '⏳' },
  enviado:                { label: 'Msg enviada',      cor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',   icon: '📤' },
  respondeu:              { label: 'Respondeu',         cor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: '💬' },
  interessado:            { label: 'Interessado',       cor: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: '🔥' },
  fechado:                { label: 'Fechou negócio',    cor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: '✅' },
  naoInteresse:           { label: 'Sem interesse',     cor: 'bg-red-500/20 text-red-300 border-red-500/30',     icon: '❌' },
  pendente_followup:      { label: 'Follow-up',         cor: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: '🔄' },
  aguardando_documentos:  { label: 'Aguard. Docs',      cor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',  icon: '📎' },
  aguardando_contato:     { label: 'Aguard. Contato',   cor: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: '📞' },
};

const STAT_KEYS = ['pendente','enviado','respondeu','interessado','fechado','naoInteresse'] as const;

interface Contato {
  id: number; nome: string; telefone: string; escritorio: string | null;
  cidade: string | null; areaAtuacao: string | null; status: string;
  etapaBot: string; criadoEm: string; _count?: { mensagens: number };
}

interface Conversa {
  id: number; nome: string; telefone: string; escritorio: string | null;
  status: string; etapaBot: string; ultimaMensagem: string;
  ultimaMensagemData: string | null; ultimaDirecao: string;
  naoLidas: number; whatsappLink: string; totalMensagens: number;
}

export default function Contatos() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nome: '', telefone: '', escritorio: '', cidade: '', areaAtuacao: '' });
  const [showCSVGuide, setShowCSVGuide] = useState(false);
  const [detailContact, setDetailContact] = useState<Contato | null>(null);
  const [detailMsgs, setDetailMsgs] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [prospectando, setProspectando] = useState(false);
  const [prospectResult, setProspectResult] = useState<any>(null);
  const [tab, setTab] = useState<'contatos' | 'conversas'>('contatos');
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversasResumo, setConversasResumo] = useState({ total: 0, naoLidas: 0, quentes: 0, followup: 0 });
  const [filtroConversa, setFiltroConversa] = useState('todas');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { carregarContatos(); }, [pagina, filtroStatus]);
  useEffect(() => { if (tab === 'conversas') carregarConversas(); }, [tab, filtroConversa]);

  async function carregarContatos() {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(pagina), limit: '30' };
      if (busca) params.busca = busca;
      if (filtroStatus) params.status = filtroStatus;
      const { data } = await api.get('/contatos', { params });
      setContatos(data.data); setTotal(data.total); setTotalPaginas(data.totalPaginas);
      try { const { data: s } = await api.get('/contatos/stats'); setStats(s); } catch {}
    } catch { toast.error('Erro ao carregar contatos'); }
    finally { setLoading(false); }
  }

  async function carregarConversas() {
    try {
      const { data } = await api.get('/contatos/conversas', { params: { tipo: filtroConversa } });
      setConversas(data.conversas || []);
      setConversasResumo(data.resumo || { total: 0, naoLidas: 0, quentes: 0, followup: 0 });
    } catch { toast.error('Erro ao carregar conversas'); }
  }

  async function salvarContato(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId) { await api.patch(`/contatos/${editingId}`, form); toast.success('Contato atualizado!'); }
      else { await api.post('/contatos', form); toast.success('Contato adicionado!'); }
      fecharForm(); carregarContatos();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Erro ao salvar'); }
  }

  function fecharForm() { setShowForm(false); setEditingId(null); setForm({ nome: '', telefone: '', escritorio: '', cidade: '', areaAtuacao: '' }); }

  function abrirEdicao(c: Contato) {
    setForm({ nome: c.nome, telefone: c.telefone, escritorio: c.escritorio || '', cidade: c.cidade || '', areaAtuacao: c.areaAtuacao || '' });
    setEditingId(c.id); setShowForm(true);
  }

  async function verDetalhe(c: Contato | Conversa) {
    setDetailContact(c as Contato);
    try { const { data } = await api.get(`/mensagens/contato/${c.id}`); setDetailMsgs(data); }
    catch { setDetailMsgs([]); }
  }

  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const csvText = ev.target?.result as string;
      if (!csvText || csvText.trim().length < 10) {
        toast.error('Arquivo CSV vazio ou invalido');
        return;
      }
      try {
        const { data } = await api.post('/contatos/importar', { csv: csvText });
        toast.success(`${data.importados} importados | ${data.duplicados} duplicados | ${data.erros} erros`);
        carregarContatos();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Erro na importacao');
      }
    };
    reader.readAsText(file, 'UTF-8');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function prospectarSelecionados() {
    if (selecionados.length === 0) { toast.error('Selecione contatos primeiro'); return; }
    if (!confirm(`Enviar mensagem de prospeccao para ${selecionados.length} contato(s)?\n\nCada envio tera intervalo de 5-7s para evitar bloqueio.`)) return;
    setProspectando(true);
    setProspectResult(null);
    try {
      const { data } = await api.post('/contatos/massa/prospectar', {
        ids: selecionados,
        delayMs: 5000,
      }, { timeout: selecionados.length * 10000 + 30000 });
      setProspectResult(data);
      toast.success(`${data.enviados} mensagens enviadas!`);
      setSelecionados([]);
      carregarContatos();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao prospectar');
    } finally {
      setProspectando(false);
    }
  }

  async function atualizarStatusMassa(novoStatus: string) {
    if (!selecionados.length) return;
    try {
      await api.patch('/contatos/massa/status', { ids: selecionados, status: novoStatus });
      toast.success(`${selecionados.length} contatos atualizados`);
      setSelecionados([]); carregarContatos();
    } catch { toast.error('Erro ao atualizar'); }
  }

  async function excluirContato(id: number) {
    if (!confirm('Excluir este contato?')) return;
    try { await api.delete(`/contatos/${id}`); toast.success('Excluido'); carregarContatos(); }
    catch { toast.error('Erro ao excluir'); }
  }

  async function excluirMassa() {
    if (!selecionados.length || !confirm(`Excluir ${selecionados.length} contatos?`)) return;
    try {
      await Promise.all(selecionados.map(id => api.delete(`/contatos/${id}`)));
      toast.success(`${selecionados.length} excluidos`); setSelecionados([]); carregarContatos();
    } catch { toast.error('Erro'); }
  }

  const toggle = (id: number) => setSelecionados(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAll = () => selecionados.length === contatos.length ? setSelecionados([]) : setSelecionados(contatos.map(c => c.id));

  function selecionarPendentes() {
    const pendentes = contatos.filter(c => c.status === 'pendente').map(c => c.id);
    setSelecionados(pendentes);
    if (pendentes.length > 0) toast.success(`${pendentes.length} pendentes selecionados`);
    else toast('Nenhum pendente nesta pagina', { icon: 'i' });
  }

  return (
    <>
      <Head><title>Contatos - Prospeccao</title></Head>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users className="w-6 h-6 text-blue-400" /> Contatos</h1>
            <p className="text-sm text-slate-400 mt-0.5">Importe, selecione e dispare prospeccoes. Acompanhe respostas na aba Conversas.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ nome:'',telefone:'',escritorio:'',cidade:'',areaAtuacao:'' }); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <UserPlus className="w-4 h-4" /> Adicionar
            </button>
            <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2 transition-colors">
              <Upload className="w-4 h-4" /> Importar CSV
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={importarCSV} />
            </label>
            <button onClick={() => setShowCSVGuide(!showCSVGuide)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 transition-colors">
              ? Formato CSV
            </button>
          </div>
        </div>

        {/* Guia CSV */}
        {showCSVGuide && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
            <div className="flex justify-between mb-2">
              <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Formato do arquivo CSV</h3>
              <button onClick={() => setShowCSVGuide(false)} className="text-blue-400"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-blue-200/80 mb-2">Colunas separadas por virgula ou ponto-e-virgula. Primeira linha = nomes:</p>
            <pre className="bg-slate-900/60 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto">
{`nome,telefone,escritorio,cidade,area_atuacao
Joao Silva,11999887766,Silva Advogados,Sao Paulo,Trabalhista
Maria Santos,21988776655,Santos & Assoc.,Rio de Janeiro,Criminal`}
            </pre>
            <div className="flex gap-4 mt-3 text-xs text-blue-200/70 flex-wrap">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> <b>nome</b> e <b>telefone</b> obrigatorios</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> Duplicados ignorados</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> Aceita virgula ou ponto-e-virgula</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> Excel: Salvar como CSV</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700">
          <button onClick={() => setTab('contatos')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'contatos' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
            <Users className="w-4 h-4" /> Contatos ({total})
          </button>
          <button onClick={() => setTab('conversas')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'conversas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
            <MessageCircle className="w-4 h-4" /> Conversas
            {conversasResumo.naoLidas > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{conversasResumo.naoLidas}</span>
            )}
          </button>
        </div>

        {/* ======= ABA CONTATOS ======= */}
        {tab === 'contatos' && (
          <>
            {/* Cards de Status */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {STAT_KEYS.map(key => {
                const info = STATUS_INFO[key];
                const active = filtroStatus === key;
                return (
                  <button key={key} onClick={() => { setFiltroStatus(active ? '' : key); setPagina(1); }}
                    className={`p-3 rounded-xl border text-left transition-all ${active ? 'bg-blue-600/20 border-blue-500/50 ring-1 ring-blue-500/30' : 'bg-slate-800/80 border-slate-700/50 hover:border-slate-600'}`}>
                    <div className="text-base mb-0.5">{info.icon}</div>
                    <div className="text-xl font-bold text-white">{stats[key] || 0}</div>
                    <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{info.label}</div>
                  </button>
                );
              })}
            </div>

            {/* Busca + Filtro */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Buscar nome, telefone ou escritorio..." value={busca}
                  onChange={e => setBusca(e.target.value)} onKeyDown={e => e.key === 'Enter' && carregarContatos()}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.open(`${api.defaults.baseURL}/contatos/exportar/csv`, '_blank')}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 flex items-center gap-1.5 transition-colors">
                  <Download className="w-4 h-4" /> Exportar
                </button>
                {filtroStatus && (
                  <button onClick={() => { setFiltroStatus(''); setPagina(1); }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 flex items-center gap-1 transition-colors">
                    <X className="w-3 h-3" /> Limpar filtro
                  </button>
                )}
              </div>
            </div>

            {/* Formulario */}
            {showForm && (
              <form onSubmit={salvarContato} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  {editingId ? <><Edit className="w-4 h-4 text-yellow-400" /> Editar Contato</> : <><UserPlus className="w-4 h-4 text-blue-400" /> Novo Contato</>}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { key: 'nome', label: 'Nome *', icon: Users, ph: 'Nome completo', req: true },
                    { key: 'telefone', label: 'Telefone * (com DDD)', icon: Phone, ph: '11999887766', req: true },
                    { key: 'escritorio', label: 'Escritorio', icon: Building2, ph: 'Nome do escritorio' },
                    { key: 'cidade', label: 'Cidade', icon: MapPin, ph: 'Sao Paulo' },
                    { key: 'areaAtuacao', label: 'Area de Atuacao', icon: Briefcase, ph: 'Trabalhista, Criminal...' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="flex items-center gap-1 text-xs text-slate-400 mb-1"><f.icon className="w-3 h-3" />{f.label}</label>
                      <input type={f.key === 'telefone' ? 'tel' : 'text'} required={f.req} value={(form as any)[f.key]}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.ph}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-1.5"><Check className="w-4 h-4" />{editingId ? 'Atualizar' : 'Salvar'}</button>
                  <button type="button" onClick={fecharForm} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium">Cancelar</button>
                </div>
              </form>
            )}

            {/* Acoes em massa */}
            {selecionados.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 bg-blue-600/10 border border-blue-600/30 rounded-xl p-3">
                <span className="text-sm text-blue-300 font-medium">{selecionados.length} selecionado(s)</span>
                <button onClick={prospectarSelecionados} disabled={prospectando}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium flex items-center gap-2 text-white transition-colors">
                  {prospectando ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><Send className="w-4 h-4" /> Prospectar</>}
                </button>
                <select onChange={e => { if (e.target.value) atualizarStatusMassa(e.target.value); e.target.value = ''; }}
                  className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white">
                  <option value="">Alterar status...</option>
                  {Object.entries(STATUS_INFO).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
                <button onClick={excluirMassa} className="px-3 py-1.5 bg-red-600/20 border border-red-500/30 rounded-lg text-sm text-red-300 hover:bg-red-600/30 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
                <button onClick={() => setSelecionados([])} className="text-xs text-slate-400 hover:text-white ml-auto">Limpar selecao</button>
              </div>
            )}

            {/* Resultado do disparo */}
            {prospectResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-emerald-300">Resultado da Prospeccao</h4>
                  <button onClick={() => setProspectResult(null)} className="text-emerald-400"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center"><div className="text-2xl font-bold text-green-400">{prospectResult.enviados}</div><div className="text-xs text-slate-400">Enviados</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-red-400">{prospectResult.falhas}</div><div className="text-xs text-slate-400">Falhas</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-white">{prospectResult.total}</div><div className="text-xs text-slate-400">Total</div></div>
                </div>
                <p className="text-xs text-emerald-200/70">Agora aguarde os contatos responderem. Acompanhe na aba Conversas.</p>
              </div>
            )}

            {/* Estado vazio */}
            {total === 0 && !loading && !filtroStatus && (
              <div className="bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-600 p-10 text-center">
                <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">Nenhum contato cadastrado</h3>
                <p className="text-sm text-slate-400 mb-5 max-w-md mx-auto">Importe uma planilha CSV com seus contatos para comecar a prospeccao.</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <button onClick={() => { setShowForm(true); setEditingId(null); }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2">
                    <UserPlus className="w-4 h-4" /> Adicionar manualmente
                  </button>
                  <label className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Importar CSV
                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={importarCSV} />
                  </label>
                </div>
              </div>
            )}

            {/* Tabela */}
            {(total > 0 || filtroStatus) && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {/* Barra de selecao rapida */}
                <div className="flex items-center gap-2 p-3 border-b border-slate-700/50 bg-slate-800/80">
                  <button onClick={selecionarPendentes} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Selecionar pendentes
                  </button>
                  <button onClick={toggleAll} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300">
                    {selecionados.length === contatos.length ? 'Desselecionar todos' : 'Selecionar todos'}
                  </button>
                  <span className="text-xs text-slate-500 ml-auto">{total} contatos no total</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left bg-slate-800/80">
                        <th className="p-3 w-10"><input type="checkbox" onChange={toggleAll} checked={selecionados.length === contatos.length && contatos.length > 0} className="rounded" /></th>
                        <th className="p-3 text-slate-400 font-medium">Nome</th>
                        <th className="p-3 text-slate-400 font-medium">Telefone</th>
                        <th className="p-3 text-slate-400 font-medium hidden md:table-cell">Escritorio</th>
                        <th className="p-3 text-slate-400 font-medium hidden lg:table-cell">Cidade</th>
                        <th className="p-3 text-slate-400 font-medium hidden lg:table-cell">Area</th>
                        <th className="p-3 text-slate-400 font-medium">Status</th>
                        <th className="p-3 text-slate-400 font-medium text-center">Msgs</th>
                        <th className="p-3 text-slate-400 font-medium text-center">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contatos.map(c => {
                        const si = STATUS_INFO[c.status] || { label: c.status, cor: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: '?' };
                        return (
                          <tr key={c.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${selecionados.includes(c.id) ? 'bg-blue-600/5' : ''}`}>
                            <td className="p-3"><input type="checkbox" checked={selecionados.includes(c.id)} onChange={() => toggle(c.id)} className="rounded" /></td>
                            <td className="p-3 text-white font-medium">{c.nome}</td>
                            <td className="p-3 text-slate-300 font-mono text-xs">{c.telefone}</td>
                            <td className="p-3 text-slate-400 hidden md:table-cell">{c.escritorio || '-'}</td>
                            <td className="p-3 text-slate-400 hidden lg:table-cell">{c.cidade || '-'}</td>
                            <td className="p-3 text-slate-400 hidden lg:table-cell">{c.areaAtuacao || '-'}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${si.cor}`}>{si.icon} {si.label}</span>
                            </td>
                            <td className="p-3 text-center text-xs text-slate-400">{c._count?.mensagens || 0}</td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-0.5">
                                <button onClick={() => verDetalhe(c)} className="p-1.5 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-700" title="Ver conversa"><Eye className="w-4 h-4" /></button>
                                <a href={`https://wa.me/${c.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="p-1.5 text-slate-400 hover:text-green-400 rounded hover:bg-slate-700" title="Abrir WhatsApp"><ExternalLink className="w-4 h-4" /></a>
                                <button onClick={() => abrirEdicao(c)} className="p-1.5 text-slate-400 hover:text-yellow-400 rounded hover:bg-slate-700" title="Editar"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => excluirContato(c.id)} className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {contatos.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-400">Nenhum contato com este filtro</td></tr>}
                    </tbody>
                  </table>
                </div>
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between p-3 border-t border-slate-700">
                    <span className="text-sm text-slate-400">{(pagina-1)*30+1}-{Math.min(pagina*30,total)} de {total}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setPagina(Math.max(1, pagina-1))} disabled={pagina===1} className="p-2 bg-slate-700 rounded-lg disabled:opacity-30 hover:bg-slate-600"><ChevronLeft className="w-4 h-4" /></button>
                      <span className="px-3 py-2 text-sm text-slate-300">{pagina}/{totalPaginas}</span>
                      <button onClick={() => setPagina(Math.min(totalPaginas, pagina+1))} disabled={pagina===totalPaginas} className="p-2 bg-slate-700 rounded-lg disabled:opacity-30 hover:bg-slate-600"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ======= ABA CONVERSAS ======= */}
        {tab === 'conversas' && (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                <div className="text-2xl font-bold text-white">{conversasResumo.total}</div>
                <div className="text-xs text-slate-400">Conversas</div>
              </div>
              <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-4 text-center cursor-pointer" onClick={() => setFiltroConversa(filtroConversa === 'pendentes' ? 'todas' : 'pendentes')}>
                <div className="text-2xl font-bold text-red-400">{conversasResumo.naoLidas}</div>
                <div className="text-xs text-red-300">Nao lidas</div>
              </div>
              <div className="bg-orange-500/10 rounded-xl border border-orange-500/30 p-4 text-center cursor-pointer" onClick={() => setFiltroConversa(filtroConversa === 'quentes' ? 'todas' : 'quentes')}>
                <div className="text-2xl font-bold text-orange-400">{conversasResumo.quentes}</div>
                <div className="text-xs text-orange-300">Quentes</div>
              </div>
              <div className="bg-purple-500/10 rounded-xl border border-purple-500/30 p-4 text-center cursor-pointer" onClick={() => setFiltroConversa(filtroConversa === 'followup' ? 'todas' : 'followup')}>
                <div className="text-2xl font-bold text-purple-400">{conversasResumo.followup}</div>
                <div className="text-xs text-purple-300">Follow-up</div>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex gap-2">
              {['todas', 'pendentes', 'quentes', 'followup'].map(f => (
                <button key={f} onClick={() => setFiltroConversa(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtroConversa === f ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                  {f === 'todas' ? 'Todas' : f === 'pendentes' ? 'Nao lidas' : f === 'quentes' ? 'Quentes' : 'Follow-up'}
                </button>
              ))}
              <button onClick={carregarConversas} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 ml-auto">Atualizar</button>
            </div>

            {/* Lista de conversas */}
            {conversas.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-600 p-10 text-center">
                <MessageCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">Nenhuma conversa ainda</h3>
                <p className="text-sm text-slate-400">Dispare mensagens na aba Contatos e aguarde as respostas.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversas.map(c => {
                  const si = STATUS_INFO[c.status] || { label: c.status, cor: 'bg-slate-500/20 text-slate-300', icon: '?' };
                  return (
                    <div key={c.id} className={`bg-slate-800 rounded-xl border p-4 flex items-center gap-4 transition-all hover:border-slate-600 ${c.naoLidas > 0 ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-700'}`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${c.status === 'interessado' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-300'}`}>
                        {c.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-white font-medium truncate">{c.nome}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0 rounded text-[10px] font-medium border ${si.cor}`}>{si.icon} {si.label}</span>
                          {c.naoLidas > 0 && <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{c.naoLidas} nova{c.naoLidas > 1 ? 's' : ''}</span>}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{c.escritorio || c.telefone}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {c.ultimaDirecao === 'recebida' ? 'Recebida: ' : 'Enviada: '} {c.ultimaMensagem || 'Sem mensagens'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {c.ultimaMensagemData && (
                          <span className="text-[10px] text-slate-500">
                            {new Date(c.ultimaMensagemData).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">{c.totalMensagens} msgs - {c.etapaBot}</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => verDetalhe(c as any)} className="p-2 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-700" title="Ver conversa"><Eye className="w-4 h-4" /></button>
                        <a href={c.whatsappLink} target="_blank" rel="noopener" className="p-2 text-slate-400 hover:text-green-400 rounded-lg hover:bg-slate-700" title="Abrir no WhatsApp"><ExternalLink className="w-4 h-4" /></a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal conversa */}
      {detailContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetailContact(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{detailContact.nome}</h3>
                <p className="text-xs text-slate-400 font-mono">{detailContact.telefone} - {detailContact.escritorio || 'Sem escritorio'}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`https://wa.me/${detailContact.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs text-white flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> WhatsApp
                </a>
                <button onClick={() => setDetailContact(null)} className="p-1.5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-4 space-y-2 max-h-[55vh] overflow-y-auto">
              {detailMsgs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Nenhuma mensagem trocada ainda</p>
              ) : detailMsgs.map((m: any) => (
                <div key={m.id} className={`flex ${m.direcao === 'enviada' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                    m.direcao === 'enviada' ? 'bg-blue-600/30 text-blue-100 rounded-br-sm' : 'bg-slate-700 text-slate-200 rounded-bl-sm'
                  }`}>
                    <p>{m.conteudo}</p>
                    <p className="text-[10px] mt-1 opacity-50">{new Date(m.criadoEm).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} - {m.etapa || ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
