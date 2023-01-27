const dotenv = require('dotenv');
const { parseError } = require('../lib/lib');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const db = require('../database');
const { formatToChartData } = require('../lib/stats');
dotenv.config();

class StatsController {
  async getIncome(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getStatsIncome',
      status: 'in progress',
      sessionInfo,
      req,
    });

    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const orders = await db.models.Order.findAll({
        where: {
          order_complete: true,
          status: 'approved',
          execute_date: {
            [db.Op.between]: [oneYearAgo, new Date()],
          },
        },
      });

      const { income, recieve } = formatToChartData(orders);

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { income, recieve }, sessionInfo });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        data: null,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }
}

module.exports = new StatsController();
