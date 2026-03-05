import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import {
  Search, Upload, Download, Trash2, Edit, Plus,
  ChevronLeft, ChevronRight, Check, X, UserPlus, FileSpreadsheet,
  Phone, Building2, MapPin, Briefcase, CheckCircle2, Users, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const STATUS_INFO: Record<string, { label: string; cor: string; icon: string }> = {
  pendente:          { label: 'Aguardando envio', cor: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: '⏳' },
  enviado:           { label: 'Msg enviada',      cor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',   icon: '📤' },
  respondeu:         { label: 'Respondeu',         cor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: '💬' },
  interessado:       { label: 'Interessado',       cor: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: '🔥' },
  fechado:           { label: 'Fechou negócio',    cor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: '✅' },
  naoInteresse:      { label: 'Sem interesse',     cor: 'bg-red-500/20 text-red-300 border-red-500/30',     icon: '❌' },
  pendente_followup: { label: 'Follow-up',         cor: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: '🔄' },
};

const STAT_KEYS = ['pendente','enviado','respondeu','interessado','fechado','naoInteresse'] as const;

interface Contato {
  id: number; nome: string; telefone: string; escritorio: string | null;
  cidade: string | null; areaAtuacao: string | null; status: string;
  etapaBot: string; criadoEm: string; _count?: { mensagens: number };
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { carregarContatos(); }, [pagina, filtroStatus]);

  async function carregarContatos() {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(pagina), limit: '30' };
      if (busca) params.busca = busca;
      if (filtroStatus) params.status = filtroStatus;
      const { data } = await api.get('/contatos', { params });
      setContatos(data.data); setTotal(data.total); setTotalPaginas(data.totalPaginas);
      // Stats via endpoint otimizado (1 query ao invés de 6)
      try {
        const { data: statsData } = await api.get('/contatos/stats');
        setStats(statsData);
      } catch { }
    } catch { toast.error('Erro ao carregar contatos'); }
    finally { setLoading(false); }
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

  async function verDetalhe(c: Contato) {
    setDetailContact(c);
    try { const { data } = await api.get(`/mensagens/contato/${c.id}`); setDetailMsgs(data); }
    catch { setDetailMsgs([]); }
  }

  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('arquivo', file);
    try {
      const { data } = await api.post('/contatos/importar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`✅ ${data.importados} importados · ${data.duplicados} duplicados · ${data.erros} erros`);
      carregarContatos();
    } catch { toast.error('Erro na importação'); }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function atualizarStatusMassa(novoStatus: string) {
    if (!selecionados.length) return;
    try {
      await api.patch('/contatos/massa/status', { ids: selecionados, status: novoStatus });
      toast.success(`${selecionados.length} contatos → ${STATUS_INFO[novoStatus]?.label || novoStatus}`);
      setSelecionados([]); carregarContatos();
    } catch { toast.error('Erro ao atualizar'); }
  }

  async function excluirContato(id: number) {
    if (!confirm('Excluir este contato?')) return;
    try { await api.delete(`/contatos/${id}`); toast.success('Excluído'); carregarContatos(); }
    catch { toast.error('Erro ao excluir'); }
  }

  async function excluirMassa() {
    if (!selecionados.length || !confirm(`Excluir ${selecionados.length} contatos?`)) return;
    try {
      await Promise.all(selecionados.map(id => api.delete(`/contatos/${id}`)));
      toast.success(`${selecionados.length} excluídos`); setSelecionados([]); carregarContatos();
    } catch { toast.error('Erro'); }
  }

  const toggle = (id: number) => setSelecionados(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAll = () => selecionados.length === contatos.length ? setSelecionados([]) : setSelecionados(contatos.map(c => c.id));

  return (
    <>
      <Head><title>Contatos — Prospecção</title></Head>
      <div className="space-y-5">

        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users className="w-6 h-6 text-blue-400" /> Contatos</h1>
            <p className="text-sm text-slate-400 mt-0.5">Gerencie os destinatários das mensagens de prospecção</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ nome:'',telefone:'',escritorio:'',cidade:'',areaAtuacao:'' }); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <UserPlus className="w-4 h-4" /> Adicionar
            </button>
            <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2 transition-colors">
              <Upload className="w-4 h-4" /> Importar CSV
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importarCSV} />
            </label>
            <button onClick={() => setShowCSVGuide(!showCSVGuide)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 transition-colors">
              ? Formato CSV
            </button>
          </div>
        </div>

        {/* ─── Guia CSV ─── */}
        {showCSVGuide && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
            <div className="flex justify-between mb-2">
              <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Formato do arquivo CSV</h3>
              <button onClick={() => setShowCSVGuide(false)} className="text-blue-400"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-blue-200/80 mb-2">Colunas separadas por vírgula. A primeira linha deve ter os nomes das colunas:</p>
            <pre className="bg-slate-900/60 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto">
{`nome,telefone,escritorio,cidade,area_atuacao
João Silva,11999887766,Silva Advogados,São Paulo,Trabalhista
Maria Santos,21988776655,Santos & Assoc.,Rio de Janeiro,Criminal`}
            </pre>
            <div className="flex gap-4 mt-3 text-xs text-blue-200/70">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> <b>nome</b> e <b>telefone</b> obrigatórios</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> Duplicados ignorados</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> Aceita Excel → CSV</span>
            </div>
          </div>
        )}

        {/* ─── Cards de Status ─── */}
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

        {/* ─── Busca + Filtro ─── */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar nome, telefone ou escritório..." value={busca}
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

        {/* ─── Formulário ─── */}
        {showForm && (
          <form onSubmit={salvarContato} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              {editingId ? <><Edit className="w-4 h-4 text-yellow-400" /> Editar Contato</> : <><UserPlus className="w-4 h-4 text-blue-400" /> Novo Contato</>}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'nome', label: 'Nome *', icon: Users, ph: 'Nome completo', req: true },
                { key: 'telefone', label: 'Telefone * (com DDD)', icon: Phone, ph: '11999887766', req: true },
                { key: 'escritorio', label: 'Escritório', icon: Building2, ph: 'Nome do escritório' },
                { key: 'cidade', label: 'Cidade', icon: MapPin, ph: 'São Paulo' },
                { key: 'areaAtuacao', label: 'Área de Atuação', icon: Briefcase, ph: 'Trabalhista, Criminal...' },
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

        {/* ─── Ações em massa ─── */}
        {selecionados.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-blue-600/10 border border-blue-600/30 rounded-xl p-3">
            <span className="text-sm text-blue-300 font-medium">{selecionados.length} selecionado(s)</span>
            <select onChange={e => { if (e.target.value) atualizarStatusMassa(e.target.value); e.target.value = ''; }}
              className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white">
              <option value="">Alterar status...</option>
              {Object.entries(STATUS_INFO).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <button onClick={excluirMassa} className="px-3 py-1.5 bg-red-600/20 border border-red-500/30 rounded-lg text-sm text-red-300 hover:bg-red-600/30 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Excluir
            </button>
            <button onClick={() => setSelecionados([])} className="text-xs text-slate-400 hover:text-white ml-auto">Limpar seleção</button>
          </div>
        )}

        {/* ─── Estado vazio ─── */}
        {total === 0 && !loading && !filtroStatus && (
          <div className="bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-600 p-10 text-center">
            <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Nenhum contato cadastrado</h3>
            <p className="text-sm text-slate-400 mb-5 max-w-md mx-auto">Adicione contatos manualmente ou importe uma planilha CSV para começar.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => { setShowForm(true); setEditingId(null); }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Adicionar manualmente
              </button>
              <label className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" /> Importar CSV
                <input type="file" accept=".csv" className="hidden" onChange={importarCSV} />
              </label>
            </div>
          </div>
        )}

        {/* ─── Tabela ─── */}
        {(total > 0 || filtroStatus) && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left bg-slate-800/80">
                    <th className="p-3 w-10"><input type="checkbox" onChange={toggleAll} checked={selecionados.length === contatos.length && contatos.length > 0} className="rounded" /></th>
                    <th className="p-3 text-slate-400 font-medium">Nome</th>
                    <th className="p-3 text-slate-400 font-medium">Telefone</th>
                    <th className="p-3 text-slate-400 font-medium hidden md:table-cell">Escritório</th>
                    <th className="p-3 text-slate-400 font-medium hidden lg:table-cell">Cidade</th>
                    <th className="p-3 text-slate-400 font-medium hidden lg:table-cell">Área</th>
                    <th className="p-3 text-slate-400 font-medium">Status</th>
                    <th className="p-3 text-slate-400 font-medium text-center">Msgs</th>
                    <th className="p-3 text-slate-400 font-medium text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contatos.map(c => {
                    const si = STATUS_INFO[c.status] || { label: c.status, cor: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: '❓' };
                    return (
                      <tr key={c.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${selecionados.includes(c.id) ? 'bg-blue-600/5' : ''}`}>
                        <td className="p-3"><input type="checkbox" checked={selecionados.includes(c.id)} onChange={() => toggle(c.id)} className="rounded" /></td>
                        <td className="p-3 text-white font-medium">{c.nome}</td>
                        <td className="p-3 text-slate-300 font-mono text-xs">{c.telefone}</td>
                        <td className="p-3 text-slate-400 hidden md:table-cell">{c.escritorio || '—'}</td>
                        <td className="p-3 text-slate-400 hidden lg:table-cell">{c.cidade || '—'}</td>
                        <td className="p-3 text-slate-400 hidden lg:table-cell">{c.areaAtuacao || '—'}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${si.cor}`}>{si.icon} {si.label}</span>
                        </td>
                        <td className="p-3 text-center text-xs text-slate-400">{c._count?.mensagens || 0}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-0.5">
                            <button onClick={() => verDetalhe(c)} className="p-1.5 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-700" title="Ver conversa"><Eye className="w-4 h-4" /></button>
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
                <span className="text-sm text-slate-400">{(pagina-1)*30+1}–{Math.min(pagina*30,total)} de {total}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPagina(Math.max(1, pagina-1))} disabled={pagina===1} className="p-2 bg-slate-700 rounded-lg disabled:opacity-30 hover:bg-slate-600"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="px-3 py-2 text-sm text-slate-300">{pagina}/{totalPaginas}</span>
                  <button onClick={() => setPagina(Math.min(totalPaginas, pagina+1))} disabled={pagina===totalPaginas} className="p-2 bg-slate-700 rounded-lg disabled:opacity-30 hover:bg-slate-600"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Modal conversa ─── */}
      {detailContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetailContact(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{detailContact.nome}</h3>
                <p className="text-xs text-slate-400 font-mono">{detailContact.telefone} · {detailContact.escritorio || 'Sem escritório'}</p>
              </div>
              <button onClick={() => setDetailContact(null)} className="p-1.5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
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
                    <p className="text-[10px] mt-1 opacity-50">{new Date(m.criadoEm).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>
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
