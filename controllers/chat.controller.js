const { getChatBySessionToken, readChat } = require('../lib/chat');
const { parseError } = require('../lib/lib');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');

class ChatController {
  async getChat(req, res) {
    const sessionInfo = await checkSession(req);
    const { sessionToken, userAddress } = sessionInfo;
    const logId = await writeLog({
      action: 'getChat',
      status: 'in progress',
      sessionInfo,
      req,
    });
    try {
      let chat;
      chat = await getChatBySessionToken(sessionToken);

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data: { messages: chat ? JSON.parse(chat.messages) : [] },
        sessionInfo,
      });
    } catch (e) {
      console.log(e);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({ success: false, data: null, sessionInfo });
    }
  }
}

module.exports = new ChatController();
