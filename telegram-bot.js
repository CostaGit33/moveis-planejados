// telegram-bot.js - esqueleto do bot usando telegraf
require('dotenv').config();
const { Telegraf } = require('telegraf');
const api = require('./agent-ia');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

bot.start((ctx) => {
  ctx.reply('Olá! Bem-vindo ao sistema de orçamentos. Use /menu para ver opções.');
});

bot.command('menu', (ctx) => {
  return ctx.reply('\u{1F4CB} Menu Principal\n\n/novo_orcamento - Criar novo orçamento\n/listar_orcamentos - Listar orçamentos\n/clientes - Listar clientes');
});

bot.command('clientes', async (ctx) => {
  const clientes = await api.listar_clientes();
  if (!clientes || clientes.length === 0) return ctx.reply('Nenhum cliente encontrado.');
  const lines = clientes.slice(0, 10).map(c => `${c.id}. ${c.nome} - ${c.telefone || ''}`);
  ctx.reply(lines.join('\n'));
});

// comando simples para criar cliente via texto: /novo_cliente nome|telefone|endereco
bot.command('novo_cliente', async (ctx) => {
  const payload = ctx.message.text.replace('/novo_cliente', '').trim();
  const [nome, telefone, endereco] = payload.split('|').map(s => s && s.trim());
  if (!nome) return ctx.reply('Uso: /novo_cliente Nome|Telefone|Endereco');
  try {
    const cliente = await api.criar_cliente({ nome, telefone, endereco });
    ctx.reply(`Cliente criado: ${cliente.id} - ${cliente.nome}`);
  } catch (err) {
    console.error(err);
    ctx.reply('Erro ao criar cliente');
  }
});

// Lançar bot se token existir
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot.launch().then(() => console.log('Telegram bot rodando'));
}

module.exports = bot;
