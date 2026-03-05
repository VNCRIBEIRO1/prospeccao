// POST /api/contatos/massa/prospectar — Dispara msg1 (com botões) para contatos selecionados
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { enviarMensagem, enviarMensagemComBotoes } from '../../../../lib/evolution';
import { FLUXO } from '../../../../lib/mensagens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ids, delayMs = 5000 } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Envie { ids: [1, 2, 3], delayMs?: 5000 }' });
    }

    const contatos = await prisma.contato.findMany({
      where: { id: { in: ids } },
      orderBy: { criadoEm: 'asc' },
    });

    if (contatos.length === 0) {
      return res.json({ mensagem: 'Nenhum contato encontrado', enviados: 0, falhas: 0 });
    }

    const fluxoMsg1 = FLUXO['msg1'];
    let enviados = 0;
    let falhas = 0;
    const resultados: { id: number; nome: string; telefone: string; sucesso: boolean; erro?: string }[] = [];

    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i];

      try {
        // Enviar TODAS as mensagens da etapa msg1 (textos + botões)
        let resultado: any = { sucesso: true };
        const textos = fluxoMsg1.textos;
        const botoes = fluxoMsg1.botoes;

        for (let j = 0; j < textos.length; j++) {
          const isUltimo = j === textos.length - 1;
          if (isUltimo && botoes && botoes.length > 0) {
            resultado = await enviarMensagemComBotoes(contato.telefone, textos[j], botoes, fluxoMsg1.rodape || 'Toque em uma opção 👆');
          } else {
            resultado = await enviarMensagem(contato.telefone, textos[j]);
          }
          if (!resultado.sucesso) break;
          if (!isUltimo) await new Promise(r => setTimeout(r, 1500));
        }

        if (resultado.sucesso) {
          await prisma.contato.update({
            where: { id: contato.id },
            data: {
              status: 'enviado',
              etapaBot: 'msg1',
              ultimoEnvio: new Date(),
              tentativasSemResposta: { increment: 1 },
            },
          });
          const conteudoResumo = fluxoMsg1.textos.map(t => t.substring(0, 200)).join(' | ');
          await prisma.mensagem.create({
            data: {
              contatoId: contato.id,
              direcao: 'enviada',
              conteudo: conteudoResumo.substring(0, 500),
              etapa: 'msg1',
            },
          });
          enviados++;
          resultados.push({ id: contato.id, nome: contato.nome, telefone: contato.telefone, sucesso: true });
        } else {
          falhas++;
          resultados.push({ id: contato.id, nome: contato.nome, telefone: contato.telefone, sucesso: false, erro: resultado.erro });
        }
      } catch (e: any) {
        falhas++;
        resultados.push({ id: contato.id, nome: contato.nome, telefone: contato.telefone, sucesso: false, erro: e.message });
      }

      // Delay entre envios (exceto no ultimo)
      if (i < contatos.length - 1) {
        const delay = Math.max(3000, Math.min(delayMs, 30000)); // entre 3s e 30s
        const jitter = Math.random() * 2000; // +0-2s aleatorio
        await new Promise(r => setTimeout(r, delay + jitter));
      }
    }

    res.json({
      mensagem: `Prospecção concluída: ${enviados} enviados, ${falhas} falhas`,
      enviados,
      falhas,
      total: contatos.length,
      resultados,
    });
  } catch (error: any) {
    console.error('[Prospectar] Erro:', error);
    res.status(500).json({ error: error.message });
  }
}
