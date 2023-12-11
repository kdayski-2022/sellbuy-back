const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { getCurrentPrice, getPrices } = require('../lib/price');

class PriceController {
  async getCurrentPrice(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getCurrentPrice',
      status: 'in progress',
      sessionInfo,
      req,
    });
    try {
      let { tokenSymbol } = req.query;
      tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
      const currentPrice = await getCurrentPrice(tokenSymbol);
      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { currentPrice }, sessionInfo });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: JSON.stringify(e) });
      res.json({ success: false, data: null, sessionInfo });
    }
  }

  async getPrices(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getPrices',
      status: 'in progress',
      sessionInfo,
      req,
    });
    try {
      const { direction } = req.params;
      const { tokenSymbol } = req.query;
      const data = await getPrices(tokenSymbol, direction);
      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data,
        sessionInfo,
      });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: JSON.stringify(e) });
      res.json({ success: false, data: null, error: e, sessionInfo });
    }
  }
}

module.exports = new PriceController();
