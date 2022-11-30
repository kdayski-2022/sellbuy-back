require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('../database');
const Transfer = require('./transfer');
const { updateLog, writeLog } = require('./logger');
const { parseError } = require('./lib');
const { createMessage, getSessionByMessageId } = require('./message');
const { io } = require('../socket');
const { getChatBySessionToken, getChat } = require('./chat');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MANAGER_CHAT_ID = process.env.TELEGRAM_MANAGER_CHAT_ID;

const transfer = new Transfer();
transfer.init();

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
      const order = await db.models.Order.findOne({ where: { order_id } });

      let status, message, tx;
      const isValidToSell =
        order.direction === 'sell'
          ? order.end_index_price >= order.target_index_price
          : order.end_index_price > order.target_index_price;
      const USDCToPay = Math.floor(
        parseFloat(order.price) * order.amount + parseFloat(order.recieve)
      );
      const ETHToPay =
        parseFloat(order.amount) +
        parseFloat(order.recieve) / parseFloat(order.end_index_price);

      if (isValidToSell) {
        const res = await transfer.sendUSDC(order.from, USDCToPay);
        status = res.status;
        message = res.message;
        tx = res.tx;
      } else {
        const res = await transfer.sendETH(order.from, ETHToPay);
        status = res.status;
        message = res.message;
        tx = res.tx;
      }

      if (status === true) {
        await db.models.Order.update(
          {
            order_complete: true,
            status: 'approved',
            settlement_date: new Date(),
            eth_sold: isValidToSell,
            payout_eth: ETHToPay,
            payout_usdc: USDCToPay,
            payout_tx: tx,
          },
          { where: { order_id } }
        );
        await updateLog(logId, { status: 'success' });
        // await ctx.reply(`success!\n${message}`);
      } else {
        await db.models.Order.update(
          {
            order_complete: false,
            status,
          },
          { where: { order_id } }
        );
        await updateLog(logId, {
          status: 'failed',
          error: JSON.stringify(message),
        });
        // await ctx.reply(`failed!\n${message}`);
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
