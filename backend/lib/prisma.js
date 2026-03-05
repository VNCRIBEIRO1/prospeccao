// ============================================
// Prisma Client — Singleton compartilhado
// ============================================
const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Reutilizar instância em desenvolvimento (evita hot-reload leak)
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = prisma;
