// Teste completo do fluxo com respostas numericas (sem botoes)
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
      res.on('end', () => { try { resolve(JSON.parse(chunks)); } catch { resolve({ raw: chunks }); } });
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
      res.on('end', () => { try { resolve(JSON.parse(chunks)); } catch { resolve({ raw: chunks }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Simula mensagem de texto (usuario digitando um numero)
function simTexto(texto) {
  return {
    event: 'MESSAGES_UPSERT',
    data: {
      key: { remoteJid: '5518996311933@s.whatsapp.net', fromMe: false, id: 'T' + Date.now() },
      message: { conversation: texto },
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  };
}

async function reset(etapa, status) {
  await patch('/api/contatos/1', { etapaBot: etapa, status: status || 'pendente', tentativasSemResposta: 0 });
}

async function run() {
  console.log('=== TESTE FLUXO NUMERICO (SEM BOTOES) ===\n');

  // T1: msg1 + digita "1" -> msg2
  await reset('msg1');
  let r = await post('/api/webhook/whatsapp', simTexto('1'));
  console.log(`T1:  msg1 + "1"    -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg2' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T2: msg2 + digita "1" -> msg3a
  r = await post('/api/webhook/whatsapp', simTexto('1'));
  console.log(`T2:  msg2 + "1"    -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg3a' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T3: msg1 + digita "2" -> msg2b
  await reset('msg1');
  r = await post('/api/webhook/whatsapp', simTexto('2'));
  console.log(`T3:  msg1 + "2"    -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg2b' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T4: msg2b + digita "3" -> msg2
  r = await post('/api/webhook/whatsapp', simTexto('3'));
  console.log(`T4:  msg2b + "3"   -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg2' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T5: msg2 + digita "2" -> msg3b
  r = await post('/api/webhook/whatsapp', simTexto('2'));
  console.log(`T5:  msg2 + "2"    -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg3b' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T6: msg3b + digita "3" -> msg3c
  r = await post('/api/webhook/whatsapp', simTexto('3'));
  console.log(`T6:  msg3b + "3"   -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg3c' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T7: msg1 + digita "3" -> msg3c
  await reset('msg1');
  r = await post('/api/webhook/whatsapp', simTexto('3'));
  console.log(`T7:  msg1 + "3"    -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg3c' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T8: msg2 + digita "3" -> msg3c
  await reset('msg2', 'respondeu');
  r = await post('/api/webhook/whatsapp', simTexto('3'));
  console.log(`T8:  msg2 + "3"    -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg3c' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T9: msg2b + digita "1" -> msg2b_fim
  await reset('msg2b', 'respondeu');
  r = await post('/api/webhook/whatsapp', simTexto('1'));
  console.log(`T9:  msg2b + "1"   -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg2b_fim' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T10: msg3b + digita "1" -> msg3a
  await reset('msg3b', 'respondeu');
  r = await post('/api/webhook/whatsapp', simTexto('1'));
  console.log(`T10: msg3b + "1"   -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg3a' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T11: msg3b + digita "2" -> msg3b_repeat
  await reset('msg3b', 'respondeu');
  r = await post('/api/webhook/whatsapp', simTexto('2'));
  console.log(`T11: msg3b + "2"   -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg3b_repeat' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  console.log('\n--- TESTES VARIACAO DE FORMATO ---');

  // T12: aceita "1." (com ponto)
  await reset('msg1');
  r = await post('/api/webhook/whatsapp', simTexto('1.'));
  console.log(`T12: msg1 + "1."   -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg2' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T13: aceita "2)" (com parentese)
  await reset('msg1');
  r = await post('/api/webhook/whatsapp', simTexto('2)'));
  console.log(`T13: msg1 + "2)"   -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg2b' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T14: texto livre "quero contratar" -> opcao 1
  await reset('msg2', 'respondeu');
  r = await post('/api/webhook/whatsapp', simTexto('quero contratar'));
  console.log(`T14: msg2 + "quero contratar" -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg3a' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T15: texto livre "vou pensar" -> opcao 3
  await reset('msg2', 'respondeu');
  r = await post('/api/webhook/whatsapp', simTexto('vou pensar'));
  console.log(`T15: msg2 + "vou pensar"      -> ${r.proximaEtapa} ${r.proximaEtapa === 'msg3c' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T16: texto invalido -> reenviar_opcoes
  await reset('msg1');
  r = await post('/api/webhook/whatsapp', simTexto('kkkkk'));
  console.log(`T16: msg1 + "kkkkk" -> ${r.status} ${r.status === 'opcao_invalida' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  // T17: "parar" -> bloqueio
  await reset('msg1');
  r = await post('/api/webhook/whatsapp', simTexto('parar'));
  console.log(`T17: msg1 + "parar" -> ${r.status} ${r.status === 'bloqueado' ? '✅' : '❌ GOT: ' + JSON.stringify(r)}`);

  console.log('\n=== FIM DOS TESTES ===');
}

run().catch(e => console.error('ERRO:', e));
