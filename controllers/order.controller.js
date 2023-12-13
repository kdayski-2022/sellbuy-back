const db = require('../database');
const { getDaysDifference } = require('../lib/dates');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const { getOrder } = require('../lib/order');
const { getPrices } = require('../lib/price');
const { getPricePeriods } = require('../lib/period');
const { DIRECTION } = require('../enum/enum');

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
      const { period, price, amount, tokenSymbol } = req.query;
      const direction = req.headers['direction-type'];
      const address =
        sessionInfo.userAddress && sessionInfo.userAddress.toLowerCase();

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
    const logId = await writeLog({
      action: 'getCurrentOffer',
      status: 'in progress',
      req,
    });
    try {
      const { direction } = req.params;
      const { tokenSymbol } = req.query;

      const { prices } = await getPrices(tokenSymbol, direction);
      if (direction === DIRECTION.BUY) prices.reverse();
      const amount = '1';
      let data, order;

      for (let price of prices) {
        price = String(price);
        const { periods } = await getPricePeriods({
          direction,
          price,
          amount,
          tokenSymbol,
        });
        for (let period of periods) {
          period = String(period.timestamp);
          order = await getOrder({
            period,
            price,
            amount,
            direction,
            tokenSymbol,
          });
          if (order) {
            const prices_difference = Math.abs(
              Number(order.start_index_price) - Number(order.price)
            ).toFixed(0);
            const target_index_price =
              direction === DIRECTION.SELL
                ? order.price
                : order.start_index_price;
            const save_percent = (
              (Number(prices_difference) / target_index_price) *
              100
            ).toFixed(0);
            const market_price = Number(
              order.start_index_price.toFixed(0)
            ).toLocaleString();
            const offer_price = order.price.toLocaleString();
            data = {
              market_price,
              offer_price,
              save_percent,
              prices_difference,
            };
            break;
          }
        }
        if (order) break;
      }

      updateLog(logId, { status: 'success' });
      res.json({
        success: true,
        data,
      });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        data: null,
        message: e.message,
      });
    }
  }
}

module.exports = new OrderController();
