const axios = require('axios');
const Web3 = require('web3');
const db = require('../database');
const md5 = require('md5');
const dotenv = require('dotenv');
const isEmpty = require('is-empty');

const session = require('./session.controller.js');

const { INFURA_PROVIDERS } = require('../config/infura');
const { DECIMALS } = require('../config/network');

const { writeLog, updateLog } = require('../lib/logger');
const { calculatePayouts, getPayin } = require('../lib/order');
const { parseError } = require('../lib/lib');
const { getSubject, getDealExpirationBody, sendMail } = require('../lib/email');
const {
  formatToAdminStatistics,
  formatToChartData,
  getLogsByAction,
  formatActivityToChartData,
  updateActivities,
  formatToOrdersCountChartData,
  formatToUniqueAddressesChartData,
  formatToWebStatistics,
} = require('../lib/stats');
const { getConfigByEnv } = require('../lib/config');

dotenv.config();
const md5Salt = process.env.md5Salt;
const API_URL = process.env.API_URL;
const REF_FEE = process.env.REF_FEE;
const DB_ENV = process.env.DB_ENV;

const getCurrentPrice = async (tokenSymbol) => {
  try {
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    const { data } = await axios.get(
      `${API_URL}/public/get_book_summary_by_currency?currency=${tokenSymbol}&kind=option`
    );
    return data.result[0].estimated_delivery_price;
  } catch (e) {
    console.log(e);
    return 0;
  }
};

const setExtraFields = async (orders) => {
  try {
    const currentPriceETH = await getCurrentPrice('ETH');
    const currentPriceBTC = await getCurrentPrice('WBTC');
    const currentPrice = { ETH: currentPriceETH, WBTC: currentPriceBTC };
    if (currentPrice) {
      orders.rows = await Promise.all(
        orders.rows.map(async (order) => {
          if (new Date() > order.execute_date)
            currentPrice[order.token_symbol] = order.end_index_price;
          let { BaseToPay, USDCToPay, order_executed, payout_currency } =
            await calculatePayouts({
              ...order,
              end_index_price: currentPrice[order.token_symbol],
            });

          let payout_calculation_usdc,
            payout_calculation_eth,
            payout_calculation_wbtc = null;

          if (payout_currency === 'USDC')
            payout_calculation_usdc = parseFloat(USDCToPay).toFixed(6);
          if (payout_currency === 'ETH')
            payout_calculation_eth = parseFloat(BaseToPay).toFixed(6);
          if (payout_currency === 'WBTC')
            payout_calculation_wbtc = parseFloat(BaseToPay).toFixed(6);

          order.recieve = parseFloat(parseFloat(order.recieve).toFixed(6));

          const app_revenue =
            Math.round(
              (order.recieve / order.commission) * (1 - order.commission) * 100
            ) / 100;

          order.payout_calculation_usdc = payout_calculation_usdc;
          order.payout_calculation_eth = payout_calculation_eth;
          order.payout_calculation_wbtc = payout_calculation_wbtc;
          if (new Date() > order.execute_date) {
            order.order_executed_calculation = order.order_executed;
          } else {
            order.order_executed_calculation = order_executed;
          }
          order.payout_currency = payout_currency;
          order.commission = `${order.commission * 100}%`;
          order.execute_date = order.execute_date.toISOString().split('T')[0];
          if (app_revenue) order.app_revenue = app_revenue;
          return order;
        })
      );
    }
    return orders;
  } catch (e) {
    console.log(e);
    return orders;
  }
};

const customFilters = async (orders, filters) => {
  try {
    if (filters.execute_date) {
      orders.rows = orders.rows.filter((order) =>
        new Date(order.execute_date)
          .toISOString()
          .startsWith(filters.execute_date)
      );
    }
    if (filters.order_executed) {
      const currentPriceETH = await getCurrentPrice('ETH');
      const currentPriceBTC = await getCurrentPrice('WBTC');
      const currentPrice = { ETH: currentPriceETH, WBTC: currentPriceBTC };
      if (currentPrice) {
        const result = [];
        for (const order of orders.rows) {
          let order_executed;
          if (new Date() > order.execute_date) {
            order_executed = order.order_executed;
          } else {
            const calculate = await calculatePayouts({
              ...order,
              end_index_price: currentPrice[order.token_symbol],
            });
            order_executed = calculate.order_executed;
            order_executed =
              order_executed === 'false'
                ? order_executed
                : Boolean(order_executed);
          }
          if (String(order_executed) === String(filters.order_executed)) {
            result.push(order);
          }
        }
        orders.rows = result;
      }
    }
    return orders;
  } catch (e) {
    console.log(e);
    return orders;
  }
};

class AdminPanel {
  async login(req, res) {
    const { username, password } = req.body;
    let allow = false;
    let accessToken;
    let manager;
    if (!isEmpty(username) && !isEmpty(password)) {
      manager = await db.models.Manager.findOne({
        where: {
          login: username,
          password: md5(md5Salt + password),
        },
      });
      if (!isEmpty(manager)) {
        allow = true;
        var d = new Date();
        d.setDate(d.getDate() - 14);
        await db.models.ManagerSession.destroy({
          where: {
            createdAt: {
              [db.Op.lte]: d,
            },
          },
        });
        accessToken = session.generateToken();
        await db.models.ManagerSession.create({
          managerId: manager.id,
          accessToken,
        });
      }
    }
    if (allow) {
      res.send({ token: accessToken, role: manager.role });
    } else {
      res.status(401).send('invalid password');
    }
  }

  async makeReferralPayment(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'makeReferralPayment',
      status: 'in progress',
      req,
    });
    try {
      const { data } = req.body;
      if (!isEmpty(data)) {
        for (const id of Object.keys(data)) {
          await db.models.ReferralPayout.update(
            { paid: true },
            { where: { id } }
          );
        }
      }
      updateLog(logId, { status: 'success' });
      res.json({ success: true });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        error,
      });
    }
  }

  async getExpirationPrediction(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'getExpirationPrediction',
      status: 'in progress',
      req,
    });
    const { all, chain_id } = req.query;
    try {
      const now = new Date();
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(now.getDate() + 7);
      const and = [
        { execute_date: { [db.Op.gte]: now } },
        { order_complete: false },
        { smart_contract: true },
        { chain_id },
      ];
      if (!all) and.push({ execute_date: { [db.Op.lt]: sevenDaysLater } });
      let orders = await db.models.Order.findAll({
        where: { [db.Op.and]: and },
      });
      let lastChainId = 1;
      let web3 = new Web3(
        INFURA_PROVIDERS[DB_ENV === 'production' ? 1 : 80001]
      );
      const currentPriceETH = await getCurrentPrice('ETH');
      const currentPriceBTC = await getCurrentPrice('WBTC');
      const currentPrice = { ETH: currentPriceETH, WBTC: currentPriceBTC };
      for (const order of orders) {
        if (order.chain_id !== lastChainId) {
          lastChainId = order.chain_id;
          web3 = new Web3(INFURA_PROVIDERS[order.chain_id]);
        }
        const { BaseToPay, USDCToPay, payout_currency, order_executed } =
          await calculatePayouts({
            ...order,
            end_index_price: currentPrice[order.token_symbol],
          });
        if (payout_currency === 'USDC') {
          order.payout = USDCToPay;
        }
        if (payout_currency === order.token_symbol) {
          order.payout = BaseToPay;
        }
        order.payout_currency = payout_currency;
        order.order_executed = order_executed;
        order.payin = await getPayin(web3, order);
      }
      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: orders });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async getExpiration(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });

    const logId = await writeLog({
      action: 'getExpiration',
      status: 'in progress',
      req,
    });
    const { chain_id } = req.query;
    try {
      let orders = await db.models.Order.findAll({
        where: {
          [db.Op.and]: [
            { execute_date: { [db.Op.lte]: new Date() } },
            { order_complete: false },
            { status: 'pending_approve' },
            { smart_contract: true },
            { chain_id },
          ],
        },
      });
      let lastChainId = 1;
      let web3 = await new Web3(
        INFURA_PROVIDERS[DB_ENV === 'production' ? 1 : 80001]
      );
      for (const order of orders) {
        if (lastChainId !== order.chain_id) {
          lastChainId = order.chain_id;
          web3 = await new Web3(INFURA_PROVIDERS[order.chain_id]);
        }
        const { BaseToPay, USDCToPay, payout_currency } =
          await calculatePayouts(order);
        if (payout_currency === 'USDC') {
          order.payout = USDCToPay;
        }
        if (payout_currency === order.token_symbol) {
          order.payout = BaseToPay;
        }
        order.payin = await getPayin(web3, order);
      }
      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: orders });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async postExpiration(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });

    const logId = await writeLog({
      action: 'postExpiration',
      status: 'in progress',
      req,
    });

    const { orders, tx } = req.body;
    try {
      for (const order of orders) {
        let payout_usdc, payout_base;
        if (order.payout_currency === order.token_symbol) {
          payout_usdc = (order.payout * order.end_index_price).toFixed(
            DECIMALS['USDC']
          );
          payout_base = parseFloat(order.payout).toFixed(
            DECIMALS[order.token_symbol]
          );
        }
        if (order.payout_currency === 'USDC') {
          payout_usdc = parseFloat(order.payout).toFixed(DECIMALS['USDC']);
          payout_base = (order.payout / order.end_index_price).toFixed(
            DECIMALS[order.token_symbol]
          );
        }
        await db.models.Order.update(
          {
            order_complete: true,
            status: 'approved',
            settlement_date: new Date(),
            payout_usdc,
            payout_base,
            payout_tx: tx,
          },
          { where: { id: order.id } }
        );

        try {
          const orderDB = await db.models.Order.findOne({
            where: { id: order.id },
          });
          const orderAttempt = await db.models.OrderAttempt.findOne({
            where: { id: orderDB.attempt_id },
          });
          orderDB.bid_price = orderAttempt.bid_price;
          orderDB.estimated_delivery_price =
            orderAttempt.estimated_delivery_price;

          const userCompleteOrders = await db.models.Order.findAll({
            where: {
              from: orderDB.from.toLowerCase(),
              status: 'approved',
              order_complete: true,
            },
          });

          const totalEarned = userCompleteOrders
            .map(({ recieve }) => (recieve ? recieve : 0))
            .reduce((a, b) => a + b, 0);

          const subscription = await db.models.UserSubscription.findOne({
            where: {
              address: orderDB.from.toLowerCase(),
              transaction_notifications: true,
            },
          });

          if (subscription) {
            orderDB.subscription = subscription;
            orderDB.total = {
              earned: totalEarned,
              orders: userCompleteOrders.length,
            };
            if (DB_ENV === 'development')
              orderDB.subscription.email = 'npoqpu2010@mail.ru';
            const subject = getSubject('transaction_notifications');
            const html = getDealExpirationBody(orderDB);
            await sendMail([orderDB.subscription.email], subject, '', html);
          }
        } catch (e) {
          console.log(e);
          console.log('Send email error');
        }
      }
      res.json({
        success: true,
        data: orders,
        message: 'Orders was updated',
      });
      updateLog(logId, { status: 'success' });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async getAdminStatistics(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'getStatsWeb',
      status: 'in progress',
      req,
    });

    try {
      const orders = await db.models.Order.findAll();

      const statistic = formatToAdminStatistics(orders);

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { statistic } });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async getIncome(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'getStatsIncome',
      status: 'in progress',
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
      res.json({ success: true, data: { income, recieve } });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async getOrders(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });

    const {
      _end = 10,
      _order = 'ASC',
      _sort = 'id',
      _start = 0,
      execute_date,
      order_executed,
      order_complete,
      chain_id,
      token_symbol,
    } = req.query;

    let where = order_complete ? { order_complete } : {};
    where = chain_id ? { ...where, chain_id } : where;
    where = token_symbol ? { ...where, token_symbol } : where;
    let orders = await db.models.Order.findAndCountAll({
      where,
      offset: _start,
      limit: _end,
      order: [[_sort, _order]],
    });

    orders = await customFilters(orders, {
      execute_date,
      order_executed,
    });
    orders = await setExtraFields(orders);
    orders.count = orders.rows.length;

    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    res.setHeader('X-Total-Count', orders.count);

    return res.status(200).send(orders.rows);
  }

  async updateOrder(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'updateOrder',
      status: 'in progress',
      req,
    });
    const order = req.body;

    try {
      const { id } = order;
      await db.models.Order.update({ ...order }, { where: { id } });
      res.json({
        success: true,
        data: order,
        message: 'Order was updated',
      });
      updateLog(logId, { status: 'success' });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async getUsers(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const { _end = 10, _order = 'ASC', _sort = 'id', _start = 0 } = req.query;
    const users = await db.models.User.findAndCountAll({
      offset: _start,
      limit: _end,
      order: [[_sort, _order]],
    });
    for (const user of users.rows) {
      if (!user.nick_name) user.nick_name = 'unknown';
      if (!user.ref_fee) user.ref_fee = REF_FEE;
    }
    users.count = users.rows.length;

    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    res.setHeader('X-Total-Count', users.count);

    return res.status(200).send(users.rows);
  }

  async updateUser(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const user = req.body;

    try {
      const { id } = user;
      await db.models.User.update({ ...user }, { where: { id } });
      res.json(user);
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async getReferralPayout(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const {
      _end = 10,
      _order = 'ASC',
      _sort = 'id',
      _start = 0,
      paid,
    } = req.query;
    const where = paid === 0 || paid ? { paid } : {};
    const referralPayouts = await db.models.ReferralPayout.findAndCountAll({
      where,
      offset: _start,
      limit: _end,
      order: [[_sort, _order]],
    });
    for (const referralPayout of referralPayouts.rows) {
      try {
        const user = await db.models.User.findOne({
          where: { address: referralPayout.address.toLowerCase() },
        });
        const parent = await db.models.User.findOne({
          where: { id: user.ref_user_id },
        });
        const ref_fee = parent.ref_fee || REF_FEE || 0;
        const order = await db.models.Order.findOne({
          where: { id: referralPayout.order_id },
        });
        const appRevenue =
          (order.recieve / order.commission) * (1 - order.commission);
        const earn = (appRevenue / 100) * Number(ref_fee);
        referralPayout.app_revenue = appRevenue;
        referralPayout.earn = earn;
        referralPayout.parent = parent.address;
      } catch (e) {
        console.log(e);
        referralPayout.app_revenue = 0;
        referralPayout.earn = 0;
        referralPayout.parent = '0x0';
      }
    }
    referralPayouts.count = referralPayouts.rows.length;

    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    res.setHeader('X-Total-Count', referralPayouts.count);

    return res.status(200).send(referralPayouts.rows);
  }

  async updateReferralPayout(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const referralPayout = req.body;

    try {
      const { id } = referralPayout;
      await db.models.ReferralPayout.update(
        { ...referralPayout },
        { where: { id } }
      );
      res.json(referralPayout);
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async getConfig(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'getConfig',
      status: 'in progress',
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
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({ success: false, error });
    }
  }

  async getActivity(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'getStatsActivity',
      status: 'in progress',
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
      res.json({ success: true, data: { activities: data } });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async getOrdersCount(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'getStatsOrdersCount',
      status: 'in progress',
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
      res.json({ success: true, data });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async getUniqueAddresses(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'getStatsUniqueAddresses',
      status: 'in progress',
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
      res.json({ success: true, data });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }

  async getWebStatistics(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'getStatsWeb',
      status: 'in progress',
      req,
    });

    try {
      const orders = await db.models.Order.findAll();

      const statistics = formatToWebStatistics(orders);

      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { statistics } });
    } catch (e) {
      console.log(e);
      const error = parseError(e);
      updateLog(logId, { status: 'failed', error });
      res.json({
        success: false,
        data: null,
        error,
      });
    }
  }
}

module.exports = new AdminPanel();
