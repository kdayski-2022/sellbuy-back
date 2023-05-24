const { writeLog, updateLog } = require('../lib/logger');
const { parseError } = require('../lib/lib');
const dotenv = require('dotenv');
const { getConfigByEnv } = require('../lib/config');
dotenv.config();
const DB_ENV = process.env.DB_ENV;

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
      const config = getConfigByEnv(DB_ENV);
      res.json({
        success: true,
        config,
      });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({ success: false, error: parseError(e) });
    }
  },
};

module.exports = Config;
