const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const { getPricePeriods } = require('../lib/period');

class PeriodController {
  async getPricePeriods(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getPricePeriods',
      status: 'in progress',
      sessionInfo,
      req,
    });
    try {
      const { price, amount, tokenSymbol } = req.query;
      const direction = req.headers['direction-type'];
      const address =
        sessionInfo.userAddress && sessionInfo.userAddress.toLowerCase();
      const data = await getPricePeriods({
        tokenSymbol,
        direction,
        price,
        amount,
        address,
      });

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data,
        sessionInfo,
      });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        data: { periods: [] },
        error: e.message,
        sessionInfo,
      });
    }
  }
}

module.exports = new PeriodController();
