const dotenv = require('dotenv');
const { parseError } = require('../lib/lib');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const db = require('../database');
const {
  formatToChartData,
  formatToWebStatistics,
  formatToAdminStatistics,
  formatToOrdersCountChartData,
  formatToUniqueAddressesChartData,
  formatActivityToChartData,
  getLogsByAction,
  updateActivities,
} = require('../lib/stats');
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

  async getOrdersCount(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getStatsOrdersCount',
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

      const data = formatToOrdersCountChartData(orders);

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data, sessionInfo });
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

  async getUniqueAddresses(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getStatsUniqueAddresses',
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

      const data = formatToUniqueAddressesChartData(orders);

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data, sessionInfo });
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

  async getActivity(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getStatsActivity',
      status: 'in progress',
      sessionInfo,
      req,
    });

    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const logs = await getLogsByAction('getPricePeriods');
      const formattedData = formatActivityToChartData(logs);
      await updateActivities(formattedData.activities);

      const data = await db.models.Activity.findAll({
        order: [['year'], ['month']],
        where: {
          createdAt: {
            [db.Op.between]: [oneYearAgo, new Date()],
          },
        },
      });

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { activities: data }, sessionInfo });
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

  async getWebStatistics(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getStatsWeb',
      status: 'in progress',
      sessionInfo,
      req,
    });

    try {
      const orders = await db.models.Order.findAll();

      const statistics = formatToWebStatistics(orders);

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { statistics }, sessionInfo });
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

  async getAdminStatistics(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getStatsWeb',
      status: 'in progress',
      sessionInfo,
      req,
    });

    try {
      const orders = await db.models.Order.findAll();

      const statistic = formatToAdminStatistics(orders);

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { statistic }, sessionInfo });
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
