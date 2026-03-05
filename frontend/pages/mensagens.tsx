import { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  MessageSquare, Eye, Edit3, Save, X, ChevronDown, ChevronUp,
  Smartphone, Send, RotateCcw, Check, AlertCircle, Zap, Bot, ArrowRight,
  Hash, Type, MousePointerClick
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

interface Template {
  id: string;
  nome: string;
  conteudo: string;
  preview: string;
}

interface Botao {
  id: string;
  texto: string;
  descricao: string;
}

// Mapa de etapa → próximas etapas para visualizar o fluxo
const FLUXO_MAPA: Record<string, { label: string; descricao: string; cor: string; icone: string }> = {
  msg1:       { label: 'Mensagem Inicial',   descricao: 'Primeiro contato com o prospect', cor: 'blue',    icone: '1️⃣' },
  msg2:       { label: 'Apresentação',       descricao: 'Detalhes do produto/serviço',     cor: 'purple',  icone: '2️⃣' },
  msg2b:      { label: 'Já Tem Site',        descricao: 'Prospect que já possui site',     cor: 'indigo',  icone: '2️⃣b' },
  msg2b_fim:  { label: 'Encerramento OK',    descricao: 'Prospect bem atendido',           cor: 'slate',   icone: '✅' },
  msg3a:      { label: 'Fechamento',         descricao: 'Prospect quer contratar!',        cor: 'green',   icone: '🎉' },
  msg3b:      { label: 'Dúvidas',            descricao: 'FAQ e respostas',                 cor: 'yellow',  icone: '❓' },
  msg3b_repeat: { label: 'Dúvidas (2ª vez)', descricao: 'Último follow-up de dúvidas',     cor: 'amber',   icone: '❓' },
  msg3c:      { label: 'Vou Pensar',         descricao: 'Prospect indeciso',               cor: 'orange',  icone: '🤔' },
};

const BOTOES_MAPA: Record<string, Botao[]> = {
  msg1: [
    { id: 'opt_1', texto: '1️⃣ Sim! Quero conhecer', descricao: 'Veja um exemplo de site' },
    { id: 'opt_2', texto: '2️⃣ Já tenho site', descricao: 'Me conta sobre seu site' },
    { id: 'opt_3', texto: '3️⃣ Agora não', descricao: 'Sem compromisso' },
  ],
  msg2: [
    { id: 'opt_1', texto: '1️⃣ Quero contratar!', descricao: 'Fechar negócio' },
    { id: 'opt_2', texto: '2️⃣ Tenho dúvidas', descricao: 'Tirar dúvidas' },
    { id: 'opt_3', texto: '3️⃣ Vou pensar...', descricao: 'Sem pressa' },
  ],
  msg2b: [
    { id: 'opt_1', texto: '1️⃣ Tem tudo isso sim', descricao: 'Já está completo' },
    { id: 'opt_2', texto: '2️⃣ Tem algumas coisas', descricao: 'Faltam funcionalidades' },
    { id: 'opt_3', texto: '3️⃣ Não tem, me conta mais!', descricao: 'Quero saber mais' },
  ],
  msg3b: [
    { id: 'opt_1', texto: '1️⃣ Quero contratar!', descricao: 'Fechar negócio' },
    { id: 'opt_2', texto: '2️⃣ Ainda tenho dúvidas', descricao: 'Mais perguntas' },
    { id: 'opt_3', texto: '3️⃣ Vou pensar...', descricao: 'Sem pressa' },
  ],
};

// Destinos de cada botão por etapa
const DESTINOS: Record<string, Record<string, string>> = {
  msg1:  { opt_1: 'msg2', opt_2: 'msg2b', opt_3: 'msg3c' },
  msg2:  { opt_1: 'msg3a', opt_2: 'msg3b', opt_3: 'msg3c' },
  msg2b: { opt_1: 'msg2b_fim', opt_2: 'msg2', opt_3: 'msg2' },
  msg3b: { opt_1: 'msg3a', opt_2: 'msg3b_repeat', opt_3: 'msg3c' },
};

export default function Mensagens() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [expandedFlow, setExpandedFlow] = useState(true);
  const [sending, setSending] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testEtapa, setTestEtapa] = useState('msg1');

  useEffect(() => { carregarTemplates(); }, []);

  async function carregarTemplates() {
    setLoading(true);
    try {
      const { data } = await api.get('/mensagens/templates');
      if (Array.isArray(data)) setTemplates(data);
    } catch { toast.error('Erro ao carregar mensagens'); }
    setLoading(false);
  }

  async function salvarTemplate() {
    if (!editingId) return;
    try {
      await api.put(`/mensagens/templates/${editingId}`, { conteudo: editText });
      toast.success('✅ Mensagem salva com sucesso!');
      setEditingId(null);
      carregarTemplates();
    } catch { toast.error('Erro ao salvar'); }
  }

  async function enviarTeste() {
    if (!testPhone) { toast.error('Informe o número de teste'); return; }
    setSending(true);
    try {
      const { data } = await api.post('/mensagens/enviar-teste', {
        telefone: testPhone,
        etapa: testEtapa,
      });
      if (data.sucesso) {
        toast.success(`✅ Mensagem "${testEtapa}" enviada para ${testPhone}!`);
      } else {
        toast.error(data.erro || 'Erro ao enviar');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao enviar teste');
    }
    setSending(false);
  }

  function getTemplate(id: string) {
    return templates.find(t => t.id === id);
  }

  // Phone preview component
  function PhonePreview({ templateId }: { templateId: string }) {
    const tpl = getTemplate(templateId);
    const botoes = BOTOES_MAPA[templateId];
    if (!tpl) return null;

    return (
      <div className="w-full max-w-[320px] mx-auto">
        {/* Phone frame */}
        <div className="bg-gray-900 rounded-[2rem] p-2 shadow-2xl border border-gray-700">
          {/* Screen */}
          <div className="bg-[#0b141a] rounded-[1.5rem] overflow-hidden">
            {/* WhatsApp header */}
            <div className="bg-[#1f2c34] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Bot Prospecção</p>
                <p className="text-gray-400 text-[10px]">online</p>
              </div>
            </div>
            {/* Chat area */}
            <div className="p-3 min-h-[300px] max-h-[400px] overflow-y-auto space-y-2"
                 style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'a\' width=\'60\' height=\'60\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M30 5l5 10-10 5 5 10-10 5 5 10H15l5-10-10-5 5-10-10-5 5-10z\' fill=\'%23ffffff06\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23060d11\'/%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'url(%23a)\'/%3E%3C/svg%3E")' }}>
              {/* Message bubble */}
              <div className="flex justify-end">
                <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%] shadow">
                  <p className="text-[12px] text-gray-100 whitespace-pre-wrap leading-relaxed">
                    {tpl.conteudo.length > 600 ? tpl.conteudo.substring(0, 600) + '...' : tpl.conteudo}
                  </p>
                  <p className="text-[9px] text-gray-400 text-right mt-1">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </p>
                </div>
              </div>
              {/* Buttons */}
              {botoes && botoes.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {botoes.map((btn) => (
                    <button key={btn.id}
                      className="w-full bg-[#1f2c34] hover:bg-[#2a3942] border border-[#2a3942] rounded-lg px-3 py-2 text-center transition-colors">
                      <span className="text-[12px] text-[#53bdeb] font-medium">{btn.texto}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Input bar */}
            <div className="bg-[#1f2c34] px-3 py-2 flex items-center gap-2">
              <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5">
                <span className="text-[11px] text-gray-500">Mensagem</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                <Send className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>Mensagens — Prospecção WhatsApp</title></Head>

      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-blue-400" /> Mensagens do Bot
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Personalize cada etapa do fluxo de prospecção. Veja o preview em tempo real.
            </p>
          </div>
        </div>

        {/* ============================================ */}
        {/* SEÇÃO: FLUXO VISUAL DO BOT */}
        {/* ============================================ */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <button onClick={() => setExpandedFlow(!expandedFlow)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" /> Fluxo de Conversação
            </h2>
            {expandedFlow ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {expandedFlow && (
            <div className="px-4 pb-4">
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                {/* Flow diagram */}
                <div className="flex flex-col items-center gap-1">
                  {/* msg1 → ramificações */}
                  <FlowNode etapa="msg1" onClick={() => setPreviewId('msg1')} active={previewId === 'msg1'} />
                  <div className="flex items-center gap-2 text-slate-500">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                    <span className="text-[10px]">Respostas:</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-green-400 font-medium">Opt 1: Quero conhecer</span>
                      <ArrowRight className="w-3 h-3 rotate-90 text-slate-600" />
                      <FlowNode etapa="msg2" small onClick={() => setPreviewId('msg2')} active={previewId === 'msg2'} />
                      <ArrowRight className="w-3 h-3 rotate-90 text-slate-600" />
                      <div className="grid grid-cols-3 gap-1 w-full">
                        <FlowNode etapa="msg3a" tiny onClick={() => setPreviewId('msg3a')} active={previewId === 'msg3a'} />
                        <FlowNode etapa="msg3b" tiny onClick={() => setPreviewId('msg3b')} active={previewId === 'msg3b'} />
                        <FlowNode etapa="msg3c" tiny onClick={() => setPreviewId('msg3c')} active={previewId === 'msg3c'} />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-blue-400 font-medium">Opt 2: Já tem site</span>
                      <ArrowRight className="w-3 h-3 rotate-90 text-slate-600" />
                      <FlowNode etapa="msg2b" small onClick={() => setPreviewId('msg2b')} active={previewId === 'msg2b'} />
                      <ArrowRight className="w-3 h-3 rotate-90 text-slate-600" />
                      <FlowNode etapa="msg2b_fim" tiny onClick={() => setPreviewId('msg2b_fim')} active={previewId === 'msg2b_fim'} />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-orange-400 font-medium">Opt 3: Agora não</span>
                      <ArrowRight className="w-3 h-3 rotate-90 text-slate-600" />
                      <FlowNode etapa="msg3c" small onClick={() => setPreviewId('msg3c')} active={previewId === 'msg3c'} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* SEÇÃO: ENVIAR TESTE */}
        {/* ============================================ */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Send className="w-5 h-5 text-green-400" /> Enviar Teste
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Número (com DDD)</label>
              <input
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="5518996311933"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:border-green-500 focus:outline-none"
              />
            </div>
            <div className="w-48">
              <label className="text-xs text-slate-400 mb-1 block">Etapa</label>
              <select
                value={testEtapa}
                onChange={e => setTestEtapa(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:border-green-500 focus:outline-none"
              >
                {Object.entries(FLUXO_MAPA).map(([key, val]) => (
                  <option key={key} value={key}>{val.icone} {val.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={enviarTeste}
                disabled={sending || !testPhone}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                {sending ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar Teste
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            💡 Envia a mensagem selecionada com botões interativos para o número informado.
          </p>
        </div>

        {/* ============================================ */}
        {/* SEÇÃO: TEMPLATES COM PREVIEW */}
        {/* ============================================ */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Type className="w-5 h-5 text-purple-400" /> Templates de Mensagem
          </h2>

          {loading ? (
            <div className="text-center py-8 text-slate-400">Carregando...</div>
          ) : (
            templates.map((tpl) => {
              const flowInfo = FLUXO_MAPA[tpl.id];
              const botoes = BOTOES_MAPA[tpl.id];
              const destinos = DESTINOS[tpl.id];
              const isEditing = editingId === tpl.id;
              const isPreviewing = previewId === tpl.id;

              return (
                <div key={tpl.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  {/* Header */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{flowInfo?.icone || '📝'}</span>
                      <div>
                        <h3 className="text-white font-semibold text-sm">
                          {flowInfo?.label || tpl.nome}
                          <span className="ml-2 text-[10px] text-slate-500 font-mono bg-slate-900 px-1.5 py-0.5 rounded">{tpl.id}</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">{flowInfo?.descricao || ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setPreviewId(isPreviewing ? null : tpl.id)}
                        className={`p-2 rounded-lg text-sm transition-colors ${isPreviewing ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        title="Preview no celular">
                        <Smartphone className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditingId(isEditing ? null : tpl.id); setEditText(tpl.conteudo); }}
                        className={`p-2 rounded-lg text-sm transition-colors ${isEditing ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        title="Editar">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Content: Text preview or Edit */}
                  <div className="px-4 pb-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={Math.min(15, Math.max(5, editText.split('\n').length + 2))}
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-sm text-white font-mono resize-y focus:border-yellow-500 focus:outline-none"
                        />
                        <div className="flex items-center gap-3">
                          <button onClick={salvarTemplate}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                            <Save className="w-4 h-4" /> Salvar
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-1.5 transition-colors">
                            <X className="w-4 h-4" /> Cancelar
                          </button>
                          <button onClick={() => setEditText(tpl.conteudo)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center gap-1.5 transition-colors">
                            <RotateCcw className="w-4 h-4" /> Resetar
                          </button>
                          <span className="text-[10px] text-slate-500 ml-auto">{editText.length} caracteres</span>
                        </div>
                      </div>
                    ) : (
                      <div className={`transition-all ${isPreviewing ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}`}>
                        {/* Text content */}
                        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
                          <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-6">{tpl.conteudo}</p>
                          {tpl.conteudo.length > 300 && (
                            <button onClick={() => setPreviewId(tpl.id)}
                              className="text-xs text-blue-400 hover:text-blue-300 mt-2">
                              Ver completo →
                            </button>
                          )}
                        </div>

                        {/* Phone preview */}
                        {isPreviewing && (
                          <div className="flex justify-center">
                            <PhonePreview templateId={tpl.id} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Buttons info */}
                  {botoes && botoes.length > 0 && (
                    <div className="px-4 pb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MousePointerClick className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Botões Interativos</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {botoes.map((btn) => {
                          const destino = destinos?.[btn.id];
                          const destinoInfo = destino ? FLUXO_MAPA[destino] : null;
                          return (
                            <div key={btn.id} className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-700/50">
                              <p className="text-xs text-white font-medium">{btn.texto}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{btn.descricao}</p>
                              {destinoInfo && (
                                <div className="flex items-center gap-1 mt-1.5">
                                  <ArrowRight className="w-3 h-3 text-slate-600" />
                                  <span className="text-[10px] text-blue-400">{destinoInfo.icone} {destinoInfo.label}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ============================================ */}
        {/* DICAS */}
        {/* ============================================ */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200/80 space-y-1">
            <p className="font-semibold text-blue-200">Dicas para mensagens eficazes:</p>
            <ul className="text-xs space-y-0.5 list-disc list-inside">
              <li>Use emojis para tornar as mensagens mais visuais e amigáveis</li>
              <li>Mantenha mensagens curtas — WhatsApp é conversacional</li>
              <li>Sempre ofereça 2-3 opções claras com botões</li>
              <li>Teste o fluxo completo antes de ativar campanhas</li>
              <li>Use o botão &quot;Enviar Teste&quot; acima para verificar como cada mensagem aparece no WhatsApp</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

// Flow node component
function FlowNode({ etapa, small, tiny, active, onClick }: {
  etapa: string; small?: boolean; tiny?: boolean; active?: boolean; onClick?: () => void;
}) {
  const info = FLUXO_MAPA[etapa];
  if (!info) return null;

  const sizeClass = tiny
    ? 'px-2 py-1 text-[9px]'
    : small
      ? 'px-3 py-1.5 text-[10px]'
      : 'px-4 py-2 text-xs';

  return (
    <button
      onClick={onClick}
      className={`${sizeClass} rounded-lg border font-medium transition-all cursor-pointer hover:scale-105 ${
        active
          ? 'bg-blue-600/30 border-blue-500 text-blue-300 ring-2 ring-blue-500/30'
          : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
      }`}
    >
      {info.icone} {tiny ? etapa : info.label}
    </button>
  );
}
