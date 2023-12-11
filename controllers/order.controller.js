const axios = require('axios');
const dotenv = require('dotenv');
const db = require('../database');
const {
  getDaysDifference,
  getValidDays,
  getTimestamp,
} = require('../lib/dates');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const { USER_COMMISSION } = require('../config/constants.json');
const { getContractText, getContractHtml, getOrder } = require('../lib/order');
const { getCurrentPrice, getPrices } = require('../lib/price');
dotenv.config();
const apiUrl = process.env.API_URL;

class OrderController {
  async getOrder(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getOrder',
      status: 'in progress',
      sessionInfo,
      req,
    });
    try {
      const { period, price, amount } = req.query;
      let { tokenSymbol } = req.query;
      const direction = req.headers['direction-type'];
      const address =
        sessionInfo.userAddress && sessionInfo.userAddress.toLowerCase();
      tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;

      const data = await getOrder({
        period,
        price,
        amount,
        tokenSymbol,
        direction,
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
        data: null,
        message: e.message,
        sessionInfo,
      });
    }
  }

  async getUserOrders(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getUserOrders',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { userAddress } = req.query;
    try {
      let orderAttempts = await db.models.OrderAttempt.findAll({
        where: {
          address: userAddress.toLowerCase(),
          [db.Op.or]: [
            {
              hash: {
                [db.Op.ne]: null,
              },
              error: null,
            },
            {
              hash: null,
              error: 'Transaction mined too slow',
            },
          ],
        },
      });
      const orders = await db.models.Order.findAll({
        where: {
          from: userAddress.toLowerCase(),
          status: {
            [db.Op.ne]: 'pending',
          },
        },
      });

      orderAttempts = orderAttempts.filter(
        ({ id }) => !orders.find((order) => order.attempt_id === id)
      );

      const approvedOrders = orders.filter(
        (order) => order.status === 'approved'
      );
      const total = {};
      total.earned = 0;
      total.executed = 0;
      total.turnoverUSDC = 0;
      total.daysOnThePlatform = 0;

      for (const order of approvedOrders) {
        total.earned += Math.floor(order.recieve);
        if (order.order_executed) {
          total.executed += 1;
        }
        total.turnoverUSDC += order.payout_usdc;
        const daysDifference = getDaysDifference(order.createdAt);
        if (total.daysOnThePlatform < daysDifference) {
          total.daysOnThePlatform = daysDifference;
        }
      }

      const data = [...orderAttempts, ...orders];
      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data,
        total,
        sessionInfo,
      });
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

  async getCurrentOffer(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getCurrentOffer',
      status: 'in progress',
      sessionInfo,
      req,
    });
    try {
      const { tokenSymbol, direction } = req.query;
      const prices = await getPrices(tokenSymbol, direction);
      console.log(prices);
      const data = {};

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
        data: null,
        message: e.message,
        sessionInfo,
      });
    }
  }
}

module.exports = new OrderController();
