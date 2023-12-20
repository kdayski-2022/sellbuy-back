const db = require('../database');
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createMessage, getSessionByMessageId } = require('./message');
const { io } = require('../socket');
const { getChatBySessionToken, getChat } = require('./chat');

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPPORT_CHAT_ID = process.env.TELEGRAM_SUPPORT_CHAT_ID;
const MANAGER_CHAT_ID = process.env.TELEGRAM_MANAGER_CHAT_ID;
const CLUB_CHAT_ID = process.env.TELEGRAM_CLUB_CHAT_ID;

function Telegram() {
  if (!(this instanceof Telegram)) {
    return new Telegram();
  }

  const telegramKey = process.env.TELEGRAM_KEY;
  this.chatId = CHAT_ID;
  this.managerChatId = MANAGER_CHAT_ID;
  this.supportChatId = SUPPORT_CHAT_ID;
  this.clubChatId = CLUB_CHAT_ID;
  const bot = new Telegraf(telegramKey);
  this.bot = bot;
  bot.command('start', async (ctx) => {
    try {
      await bot.telegram.sendMessage(
        ctx.chat.id,
        'hello there! Welcome to my TYMIO bot.',
        {}
      );
    } catch (e) {
      console.log('On sending telegram message error');
      console.log(e);
    }
  });
  bot.on('message', async function (ctx) {
    try {
      let chat_access = true;
      const banMessage = 'You are banned';
      const replyMessage = ctx.message.reply_to_message;
      if (replyMessage) {
        const sessionToken = await getSessionByMessageId(
          replyMessage.message_id
        );
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
            if (user) chat_access = user.chat_access;
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
    } catch (e) {
      console.log('On sending telegram message error');
      console.log(e);
    }
  });

  bot.launch();
  console.log('bot started');
}

Telegram.prototype.send = async function send(msg, chat = 'logs') {
  try {
    if (chat === 'logs')
      await this.bot.telegram.sendMessage(this.chatId, msg, {});
    if (chat === 'support')
      await this.bot.telegram.sendMessage(this.supportChatId, msg, {});
    if (chat === 'club')
      await this.bot.telegram.sendMessage(this.clubChatId, msg, {});
  } catch (e) {
    console.log('On sending telegram message error');
    console.log(e);
  }
};

Telegram.prototype.sendToSupport = async function send(data) {
  try {
    const { userAddress, message, sessionToken } = data;
    const msg = `User: ${userAddress}\n${message}`;
    const { message_id } = await this.bot.telegram.sendMessage(
      this.supportChatId,
      msg,
      {}
    );
    await createMessage({ message_id, message, sessionToken });
  } catch (e) {
    console.log('On sending telegram message error');
    console.log(e);
  }
};

Telegram.prototype.sendApprove = async function send(msg, order) {
  try {
    const buttons = Markup.inlineKeyboard([
      Markup.button.callback('Yes', `approve_${order.order_id}`),
      Markup.button.callback('No', `deny_${order.order_id}`),
    ]);

    await this.bot.telegram.sendMessage(this.managerChatId, msg);
  } catch (e) {
    console.log('On sending telegram message error');
    console.log(e);
  }
};

module.exports = Telegram;
