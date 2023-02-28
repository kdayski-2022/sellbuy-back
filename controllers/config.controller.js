const dotenv = require('dotenv');
const { writeLog, updateLog } = require('../lib/logger');
const { parseError } = require('../lib/lib');

dotenv.config();
const SERVICE_WALLET_ADDRESS = process.env.SERVICE_WALLET_ADDRESS;

const Config = {
  getConfig: async (req, res) => {
    const logId = await writeLog({
      action: 'getConfig',
      status: 'in progress',
      sessionInfo: {},
      req,
    });
    try {
      updateLog(logId, { status: 'success' });
      res.json({ success: true, config: { SERVICE_WALLET_ADDRESS } });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({ success: false, error: parseError(e) });
    }
  },
};

module.exports = Config;
