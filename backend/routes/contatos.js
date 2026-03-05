// ============================================
// Rotas — Contatos (CRUD + importação CSV)
// ============================================
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../services/logger');

const upload = multer({ dest: path.join(os.tmpdir(), 'uploads'), limits: { fileSize: 10 * 1024 * 1024 } });

// GET — Listar todos os contatos com filtros
router.get('/', async (req, res) => {
  try {
    const { status, cidade, area, busca, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (cidade) where.cidade = { contains: cidade };
    if (area) where.areaAtuacao = { contains: area };
    if (busca) {
      where.OR = [
        { nome: { contains: busca } },
        { telefone: { contains: busca } },
        { escritorio: { contains: busca } }
      ];
    }

    const [contatos, total] = await Promise.all([
      prisma.contato.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { criadoEm: 'desc' },
        include: { _count: { select: { mensagens: true } } }
      }),
      prisma.contato.count({ where })
    ]);

    res.json({
      data: contatos,
      total,
      pagina: parseInt(page),
      totalPaginas: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    logger.error('Erro ao listar contatos', { erro: error.message });
    res.status(500).json({ error: error.message });
  }
});

// GET — Estatísticas por status (otimizado — 1 query)
router.get('/stats', async (req, res) => {
  try {
    const grupos = await prisma.contato.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    const stats = {};
    let total = 0;
    grupos.forEach(g => {
      stats[g.status] = g._count.id;
      total += g._count.id;
    });
    stats.total = total;
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Exportar contatos como CSV (DEVE vir antes de /:id)
router.get('/exportar/csv', async (req, res) => {
  try {
    const contatos = await prisma.contato.findMany({ orderBy: { criadoEm: 'desc' } });
    const csv = [
      'nome,telefone,escritorio,cidade,area_atuacao,status,etapa_bot,criado_em',
      ...contatos.map(c =>
        `"${c.nome}","${c.telefone}","${c.escritorio || ''}","${c.cidade || ''}","${c.areaAtuacao || ''}","${c.status}","${c.etapaBot}","${c.criadoEm.toISOString()}"`
      )
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contatos.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Buscar contato por telefone
router.get('/telefone/:telefone', async (req, res) => {
  try {
    const contato = await prisma.contato.findFirst({
      where: { telefone: { contains: req.params.telefone.replace(/\D/g, '') } },
      include: { mensagens: { orderBy: { criadoEm: 'desc' }, take: 20 } }
    });

    if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });
    res.json(contato);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET — Buscar contato por ID
router.get('/:id', async (req, res) => {
  try {
    const contato = await prisma.contato.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        mensagens: { orderBy: { criadoEm: 'desc' } },
        leads: true
      }
    });

    if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });
    res.json(contato);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Criar contato
router.post('/', async (req, res) => {
  try {
    const { nome, telefone, escritorio, cidade, areaAtuacao } = req.body;

    if (!nome || !telefone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
    }

    const contato = await prisma.contato.create({
      data: {
        nome,
        telefone: telefone.replace(/\D/g, ''),
        escritorio,
        cidade,
        areaAtuacao
      }
    });

    res.status(201).json(contato);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Telefone já cadastrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST — Importar CSV
router.post('/importar', upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo CSV é obrigatório' });

    const conteudo = fs.readFileSync(req.file.path, 'utf-8');
    const registros = parse(conteudo, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });

    let importados = 0;
    let duplicados = 0;
    let erros = 0;

    for (const reg of registros) {
      try {
        const telefone = (reg.telefone || reg.phone || reg.Telefone || '').replace(/\D/g, '');
        const nome = reg.nome || reg.name || reg.Nome || 'Sem nome';

        if (!telefone || telefone.length < 10) {
          erros++;
          continue;
        }

        await prisma.contato.create({
          data: {
            nome,
            telefone,
            escritorio: reg.escritorio || reg.office || reg.Escritorio || null,
            cidade: reg.cidade || reg.city || reg.Cidade || null,
            areaAtuacao: reg.area_atuacao || reg.areaAtuacao || reg.area || reg.Area || null
          }
        });
        importados++;
      } catch (e) {
        if (e.code === 'P2002') duplicados++;
        else erros++;
      }
    }

    // Limpar arquivo temporário
    fs.unlinkSync(req.file.path);

    res.json({
      mensagem: 'Importação concluída',
      importados,
      duplicados,
      erros,
      total: registros.length
    });
  } catch (error) {
    logger.error('Erro na importação CSV', { erro: error.message });
    res.status(500).json({ error: error.message });
  }
});

// PATCH — Atualizar contato
router.patch('/:id', async (req, res) => {
  try {
    const contato = await prisma.contato.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(contato);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH — Atualizar status em massa
router.patch('/massa/status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || !status) {
      return res.status(400).json({ error: 'IDs (array) e status são obrigatórios' });
    }

    await prisma.contato.updateMany({
      where: { id: { in: ids } },
      data: { status }
    });

    res.json({ mensagem: `${ids.length} contatos atualizados para ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE — Excluir contato
router.delete('/:id', async (req, res) => {
  try {
    await prisma.contato.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ mensagem: 'Contato excluído' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
