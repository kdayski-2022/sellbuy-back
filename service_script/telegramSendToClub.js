const { Telegraf } = require('telegraf');

const CLUB_CHAT_ID = '';
const TELEGRAM_KEY = '';
const MESSAGE = '';

function Telegram() {
  if (!(this instanceof Telegram)) {
    return new Telegram();
  }
  this.clubChatId = CLUB_CHAT_ID;
  const bot = new Telegraf(TELEGRAM_KEY);
  this.bot = bot;
  bot.launch();
}

Telegram.prototype.send = async function send(msg) {
  try {
    await this.bot.telegram.sendMessage(this.clubChatId, msg, {
      disable_notification: true,
    });
  } catch (e) {
    console.log('On sending telegram message error');
    console.log(e);
  }
};

const telegram = new Telegram();
telegram.send(MESSAGE);
