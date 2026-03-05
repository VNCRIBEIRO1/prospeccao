import { ArrowRight, ArrowDown, MessageSquare, Bot, Bell, Clock } from 'lucide-react';

const FLUXO = [
  {
    id: 'msg1',
    label: 'Mensagem 1',
    desc: 'Disparo inicial (automático)',
    cor: 'border-blue-500 bg-blue-500/10',
    saidas: [
      { label: '1️⃣ Sim, quero', destino: 'msg2' },
      { label: '2️⃣ Já tenho site', destino: 'msg2b' },
      { label: '3️⃣ Agora não', destino: 'msg3c' },
    ],
  },
  {
    id: 'msg2',
    label: 'Mensagem 2',
    desc: 'Portfólio + detalhes',
    cor: 'border-purple-500 bg-purple-500/10',
    saidas: [
      { label: '1️⃣ Quero contratar', destino: 'msg3a' },
      { label: '2️⃣ Dúvidas', destino: 'msg3b' },
      { label: '3️⃣ Vou pensar', destino: 'msg3c' },
    ],
  },
  {
    id: 'msg2b',
    label: 'Mensagem 2B',
    desc: 'Qualificação (já tem site)',
    cor: 'border-cyan-500 bg-cyan-500/10',
    saidas: [
      { label: '1️⃣ Tem tudo', destino: 'msg2b_fim' },
      { label: '2️⃣/3️⃣ Não tem tudo', destino: 'msg2' },
    ],
  },
  {
    id: 'msg2b_fim',
    label: 'MSG 2B Fim',
    desc: 'Encerramento educado',
    cor: 'border-slate-500 bg-slate-500/10',
    saidas: [],
    final: true,
  },
  {
    id: 'msg3a',
    label: 'Mensagem 3A',
    desc: '🔥 Fechamento + notificação',
    cor: 'border-emerald-500 bg-emerald-500/10',
    saidas: [],
    final: true,
    notifica: true,
  },
  {
    id: 'msg3b',
    label: 'Mensagem 3B',
    desc: 'FAQ / Dúvidas',
    cor: 'border-yellow-500 bg-yellow-500/10',
    saidas: [
      { label: '1️⃣ Contratar', destino: 'msg3a' },
      { label: '2️⃣ Mais dúvidas', destino: 'msg3b (1x)' },
      { label: '3️⃣ Pensar', destino: 'msg3c' },
    ],
  },
  {
    id: 'msg3c',
    label: 'Mensagem 3C',
    desc: 'Follow-up (indeciso)',
    cor: 'border-orange-500 bg-orange-500/10',
    saidas: [],
    final: true,
    followup: true,
  },
];

export default function FluxoBot() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Bot className="w-5 h-5 text-blue-400" />
        Fluxo do Bot
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {FLUXO.map((etapa) => (
          <div
            key={etapa.id}
            className={`rounded-xl border-2 ${etapa.cor} p-4 space-y-3`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">{etapa.label}</h3>
              <div className="flex gap-1">
                {etapa.notifica && <Bell className="w-4 h-4 text-yellow-400" />}
                {etapa.followup && <Clock className="w-4 h-4 text-orange-400" />}
                {etapa.final && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">FIM</span>}
              </div>
            </div>

            <p className="text-xs text-slate-400">{etapa.desc}</p>

            {etapa.saidas.length > 0 && (
              <div className="space-y-1.5">
                {etapa.saidas.map((saida, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="text-slate-300">{saida.label}</span>
                    <span className="text-blue-400 font-mono">→ {saida.destino}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-400 bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3 text-blue-400" /> Mensagem automática</span>
        <span className="flex items-center gap-1"><Bell className="w-3 h-3 text-yellow-400" /> Envia notificação Telegram</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-orange-400" /> Follow-up em 3 dias</span>
        <span className="flex items-center gap-1"><span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded">FIM</span> Encerra fluxo automático</span>
      </div>
    </div>
  );
}
