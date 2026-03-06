// Teste do fluxo completo de botões
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let chunks = '';
      res.on('data', (d) => chunks += d);
      res.on('end', () => resolve(JSON.parse(chunks)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function patch(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let chunks = '';
      res.on('data', (d) => chunks += d);
      res.on('end', () => resolve(JSON.parse(chunks)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function simClick(buttonId, displayText) {
  return {
    event: 'MESSAGES_UPSERT',
    data: {
      key: { remoteJid: '5518996311933@s.whatsapp.net', fromMe: false, id: 'T' + Date.now() },
      message: {
        interactiveResponseMessage: {
          nativeFlowResponseMessage: {
            name: 'quick_reply',
            paramsJson: JSON.stringify({ display_text: displayText, id: buttonId })
          }
        }
      },
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  };
}

async function run() {
  console.log('=== TESTE COMPLETO DO FLUXO DE BOTÕES ===\n');

  // Reset
  await patch('/api/contatos/1', { etapaBot: 'msg1', status: 'pendente', tentativasSemResposta: 0 });
  console.log('Reset -> msg1\n');

  // T1: msg1 + opt_1 -> msg2
  let r = await post('/api/webhook/whatsapp', simClick('opt_1', 'Sim! Quero conhecer'));
  console.log(`T1: msg1 + opt_1 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg2' ? '✅' : '❌'}`);

  // T2: msg2 + opt_1 -> msg3a (quero contratar)
  r = await post('/api/webhook/whatsapp', simClick('opt_1', 'Quero contratar!'));
  console.log(`T2: msg2 + opt_1 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg3a' ? '✅' : '❌'}`);

  // Reset para msg1
  await patch('/api/contatos/1', { etapaBot: 'msg1', status: 'pendente', tentativasSemResposta: 0 });

  // T3: msg1 + opt_2 -> msg2b (já tenho site)
  r = await post('/api/webhook/whatsapp', simClick('opt_2', 'Já tenho site'));
  console.log(`T3: msg1 + opt_2 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg2b' ? '✅' : '❌'}`);

  // T4: msg2b + opt_3 -> msg2 (não tem, me conta mais)
  r = await post('/api/webhook/whatsapp', simClick('opt_3', 'Não tem, me conta mais!'));
  console.log(`T4: msg2b + opt_3 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg2' ? '✅' : '❌'}`);

  // T5: msg2 + opt_2 -> msg3b (tenho dúvidas)
  r = await post('/api/webhook/whatsapp', simClick('opt_2', 'Tenho dúvidas'));
  console.log(`T5: msg2 + opt_2 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg3b' ? '✅' : '❌'}`);

  // T6: msg3b + opt_3 -> msg3c (vou pensar)
  r = await post('/api/webhook/whatsapp', simClick('opt_3', 'Vou pensar...'));
  console.log(`T6: msg3b + opt_3 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg3c' ? '✅' : '❌'}`);

  // Reset para msg1
  await patch('/api/contatos/1', { etapaBot: 'msg1', status: 'pendente', tentativasSemResposta: 0 });

  // T7: msg1 + opt_3 -> msg3c (agora não)
  r = await post('/api/webhook/whatsapp', simClick('opt_3', 'Agora não'));
  console.log(`T7: msg1 + opt_3 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg3c' ? '✅' : '❌'}`);

  // Reset para msg2
  await patch('/api/contatos/1', { etapaBot: 'msg2', status: 'respondeu', tentativasSemResposta: 0 });

  // T8: msg2 + opt_3 -> msg3c (vou pensar no msg2)
  r = await post('/api/webhook/whatsapp', simClick('opt_3', 'Vou pensar...'));
  console.log(`T8: msg2 + opt_3 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg3c' ? '✅' : '❌'}`);

  // Reset para msg2b
  await patch('/api/contatos/1', { etapaBot: 'msg2b', status: 'respondeu', tentativasSemResposta: 0 });

  // T9: msg2b + opt_1 -> msg2b_fim (tem tudo sim)
  r = await post('/api/webhook/whatsapp', simClick('opt_1', 'Tem tudo isso sim'));
  console.log(`T9: msg2b + opt_1 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg2b_fim' ? '✅' : '❌'}`);

  // Reset para msg3b
  await patch('/api/contatos/1', { etapaBot: 'msg3b', status: 'respondeu', tentativasSemResposta: 0 });

  // T10: msg3b + opt_1 -> msg3a (quero contratar na msg3b)
  r = await post('/api/webhook/whatsapp', simClick('opt_1', 'Quero contratar!'));
  console.log(`T10: msg3b + opt_1 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg3a' ? '✅' : '❌'}`);

  // Reset para msg3b
  await patch('/api/contatos/1', { etapaBot: 'msg3b', status: 'respondeu', tentativasSemResposta: 0 });

  // T11: msg3b + opt_2 -> msg3b_repeat (ainda tenho dúvidas)
  r = await post('/api/webhook/whatsapp', simClick('opt_2', 'Ainda tenho dúvidas'));
  console.log(`T11: msg3b + opt_2 -> ${r.proximaEtapa} (${r.acao}) ${r.proximaEtapa === 'msg3b_repeat' ? '✅' : '❌'}`);

  console.log('\n=== FIM DOS TESTES ===');
}

run().catch(e => console.error('ERRO:', e));
