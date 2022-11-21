const db = require('../database');
const { parseError } = require('../lib/lib');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');

class SupportController {
  async postSupport(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'postSupport',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { email, message } = req.body;
    const direction = req.headers['direction-type'];
    const address = req.headers['user-address'];

    try {
      await db.models.Support.create({ email, message, address, direction });

      telegram.send(`User ${email} requested:\n${message}`);
      res.json({
        success: true,
        message: 'Support message was sent',
        sessionInfo,
      });
      updateLog(logId, { status: 'success' });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        error: parseError(e),
        sessionInfo,
      });
    }
  }
}

module.exports = new SupportController();
