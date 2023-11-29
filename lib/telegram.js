const db = require('../database');
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createMessage, getSessionByMessageId } = require('./message');
const { io } = require('../socket');
const { getChatBySessionToken, getChat } = require('./chat');

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPPORT_CHAT_ID = process.env.TELEGRAM_SUPPORT_CHAT_ID;
const MANAGER_CHAT_ID = process.env.TELEGRAM_MANAGER_CHAT_ID;

function Telegram() {
  if (!(this instanceof Telegram)) {
    return new Telegram();
  }

  const telegramKey = process.env.TELEGRAM_KEY;
  this.chatId = CHAT_ID;
  this.managerChatId = MANAGER_CHAT_ID;
  this.supportChatId = SUPPORT_CHAT_ID;
  const bot = new Telegraf(telegramKey);
  this.bot = bot;
  bot.command('start', (ctx) => {
    bot.telegram.sendMessage(
      ctx.chat.id,
      'hello there! Welcome to my TYMIO bot.',
      {}
    );
  });
  bot.on('message', async function (ctx) {
    let chat_access = true;
    const banMessage = 'You are banned';
    const replyMessage = ctx.message.reply_to_message;
    if (replyMessage) {
      const sessionToken = await getSessionByMessageId(replyMessage.message_id);
      if (sessionToken) {
        let chat = await getChatBySessionToken(sessionToken);

        const userSession = await db.models.UserSession.findOne({
          where: { sessionToken },
        });
        if (userSession && userSession.userAddress) {
          if (ctx.message.text.toLowerCase() === 'block')
            await db.models.User.update(
              { chat_access: false },
              {
                where: { address: userSession.userAddress },
              }
            );
          const user = await db.models.User.findOne({
            where: { address: userSession.userAddress },
          });
          chat_access = user.chat_access;
        }

        const opts = {
          message:
            ctx.message.text.toLowerCase() === 'block'
              ? banMessage
              : ctx.message.text,
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

  bot.launch();
  console.log('bot started');
}

Telegram.prototype.send = function send(msg, chat = 'logs') {
  if (chat === 'logs') this.bot.telegram.sendMessage(this.chatId, msg, {});
  if (chat === 'support')
    this.bot.telegram.sendMessage(this.supportChatId, msg, {});
};

Telegram.prototype.sendToSupport = async function send(data) {
  const { userAddress, message, sessionToken } = data;
  const msg = `User: ${userAddress}\n${message}`;
  const { message_id } = await this.bot.telegram.sendMessage(
    this.supportChatId,
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

  this.bot.telegram.sendMessage(this.managerChatId, msg);
};

module.exports = Telegram;
