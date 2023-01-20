require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('../database');
const { updateLog, writeLog } = require('./logger');
const { parseError } = require('./lib');
const { createMessage, getSessionByMessageId } = require('./message');
const { io } = require('../socket');
const { getChatBySessionToken, getChat } = require('./chat');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MANAGER_CHAT_ID = process.env.TELEGRAM_MANAGER_CHAT_ID;
const { approve } = require('./order');

function Telegram() {
  if (!(this instanceof Telegram)) {
    return new Telegram();
  }

  const telegramKey = process.env.TELEGRAM_KEY;
  this.chatId = CHAT_ID;
  this.managerChatId = MANAGER_CHAT_ID;
  const bot = new Telegraf(telegramKey);
  this.bot = bot;
  bot.command('start', (ctx) => {
    bot.telegram.sendMessage(
      ctx.chat.id,
      'hello there! Welcome to my TYMIO bot.',
      {}
    );
  });
  bot.on('message', async function (ctx, next) {
    const replyMessage = ctx.message.reply_to_message;
    if (replyMessage) {
      const sessionToken = await getSessionByMessageId(replyMessage.message_id);
      if (sessionToken) {
        let chat = await getChatBySessionToken(sessionToken);
        const opts = {
          message: ctx.message.text,
          sessionToken,
          sender: 'manager',
          userAddress: chat.userAddress,
          unread: true,
        };
        await createMessage({
          message_id: ctx.message.message_id,
          message: ctx.message.message,
          sessionToken,
        });
        chat = await getChat(chat, opts);

        io.in(sessionToken).emit(
          'newChatMessage',
          chat ? JSON.parse(chat.messages) : []
        );
      }
    }
  });

  bot.action(/approve_ETH-[0-9]+/i, async (ctx) => {
    const logId = await writeLog({
      action: 'telegram approve send action',
      status: 'in progress',
    });
    try {
      await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]));
      const order_id = ctx.match.input
        .split('approve_')
        .filter((i) => i)
        .find((i) => i);
      const { status, message } = await approve(order_id);

      if (status === 'success') {
        await updateLog(logId, { status });
        await ctx.reply(`success!\nhttps://etherscan.io/tx/${message}`);
      } else {
        await updateLog(logId, {
          status,
          error: JSON.stringify(message),
        });
        await ctx.reply(`failed!\n${message}`);
      }
    } catch (e) {
      await updateLog(logId, { status: 'failed', error: parseError(e) });
    }
  });

  bot.action(/deny_ETH-[0-9]+/i, async (ctx) => {
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]));

    const order_id = ctx.match.input
      .split('deny_')
      .filter((i) => i)
      .find((i) => i);
    await db.models.Order.update(
      { order_complete: true, status: 'denied', settlement_date: new Date() },
      { where: { order_id } }
    );

    // await ctx.reply('success!');
  });

  bot.launch();
  console.log('bot started');
}

Telegram.prototype.send = function send(msg) {
  this.bot.telegram.sendMessage(this.chatId, msg, {});
};

Telegram.prototype.sendToSupport = async function send(data) {
  const { userAddress, message, sessionToken } = data;
  const msg = `User: ${userAddress}\n${message}`;
  const { message_id } = await this.bot.telegram.sendMessage(
    this.chatId,
    msg,
    {}
  );
  await createMessage({ message_id, message, sessionToken });
};

Telegram.prototype.sendApprove = function send(msg, order) {
  const buttons = Markup.inlineKeyboard([
    Markup.button.callback('Yes', `approve_${order.order_id}`),
    Markup.button.callback('No', `deny_${order.order_id}`),
  ]);

  this.bot.telegram.sendMessage(this.managerChatId, msg, {
    reply_markup: buttons.reply_markup,
  });
};

module.exports = Telegram;
