const axios = require('axios');
const crypto = require('crypto');
const Web3 = require('web3');
const db = require('../database');
const md5 = require('md5');
const dotenv = require('dotenv');
const isEmpty = require('is-empty');

const session = require('./session.controller.js');

const { INFURA_PROVIDERS } = require('../config/infura');
const {
  DECIMALS,
  TOKEN_ADDRESS,
  CHAIN_NETWORKS,
  REFERRAL_CONTRACT_ADDRESS,
  SERVICE_WALLET_ADDRESS,
} = require('../config/network');
const ReferralAbi = require('../abi/Referral.json');

const { writeLog, updateLog } = require('../lib/logger');
const { calculatePayouts, getPayin } = require('../lib/order');
const {
  parseError,
  convertFloatToBnString,
  removeLeadingZeros,
  verifyCaptchaToken,
} = require('../lib/lib');
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
const Eth = require('../lib/etherscan.js');
const { ACTIVITY_NAMES, ACTIVITY_VALUES } = require('../enum/enum.js');
const {
  createOrUpdateUserPointsHistory,
  createAmountEarned,
  createReferralAmountEarned,
  createTimeOnPlatform,
} = require('../lib/user.js');
const { getDaysDifference } = require('../lib/dates.js');
const { getCurrentPrice } = require('../lib/price.js');

dotenv.config();
const md5Salt = process.env.md5Salt;
const API_URL = process.env.API_URL;
const REF_FEE = process.env.REF_FEE;
const DB_ENV = process.env.DB_ENV;
const METAMASK_PRIV_KEY = process.env.METAMASK_PRIV_KEY;

const spliceForPagination = async (items, pagination) => {
  try {
    items.count = items.rows.length;
    if (!pagination) pagination = { _start: 0, _end: 10 };
    const { _start, _end } = pagination;
    items.rows = items.rows.slice(_start, _end);
    return items;
  } catch (e) {
    console.log(e);
    return items;
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

const generateRef = async () => {
  let ref_code = crypto.randomBytes(3).toString('hex');
  let user = await db.models.User.findOne({
    where: {
      ref_code,
    },
  });
  if (!user) {
    return ref_code;
  } else {
    for (let i = 0; i < 5; i++) {
      ref_code = crypto.randomBytes(3).toString('hex');
      user = await db.models.User.findOne({
        where: {
          ref_code,
        },
      });
      if (!user) {
        break;
      }
    }
    return ref_code;
  }
};
const createUser = async (address) => {
  try {
    ref_code = await generateRef();
    await db.models.User.create({
      address,
      ref_code,
    });
    await createOrUpdateUserPointsHistory(address);
    const user = await db.models.User.findOne({
      where: {
        address,
        ref_code,
      },
    });
    return user;
  } catch (e) {
    throw e;
  }
};

const getExpirationReferralPayout = async (orders) => {
  try {
    const addresses = [];
    let amount = [];
    let chain_id;
    for (const order of orders) {
      chain_id = order.chain_id;
      const address = order.from;
      let user = await db.models.User.findOne({ where: { address } });
      if (!user) user = await createUser(address);
      if (user.ref_user_id && !order.first_tx) {
        const ambassador = await db.models.User.findOne({
          where: { id: user.ref_user_id },
        });
        const ref_fee = ambassador.ref_fee;
        let appRevenue =
          (order.recieve / order.commission) * (1 - order.commission);
        let payout = (appRevenue / 100) * Number(ref_fee);
        appRevenue = appRevenue.toFixed(2);
        payout = payout.toFixed(2);

        try {
          await createReferralAmountEarned(ambassador.address, order.recieve);
        } catch (e) {
          console.log(e);
          console.log('While adding referral points history error');
        }

        const contains = addresses.findIndex(
          (address) => address === ambassador.address
        );
        if (contains === -1) {
          addresses.push(ambassador.address);
          amount.push(payout);
        } else {
          amount[contains] = (
            Number(amount[contains]) + Number(payout)
          ).toFixed(2);
        }
      }
    }
    addresses.forEach((address, index) => {
      db.models.ReferralContractIncome.create({
        address,
        amount: amount[index],
        chain_id,
      });
    });
    amount = await Promise.all(
      amount.map((item) =>
        removeLeadingZeros(convertFloatToBnString(item, DECIMALS.USDC))
      )
    );
    return { addresses, amount };
  } catch (e) {
    throw e;
  }
};

const addReferralBalance = async ({ addresses, amount }) => {
  try {
    const chain_id =
      DB_ENV === 'production' ? CHAIN_NETWORKS.Arbitrum : CHAIN_NETWORKS.Mumbai;

    const web3 = await new Web3(
      new Web3.providers.HttpProvider(INFURA_PROVIDERS[chain_id])
    );
    await web3.eth.accounts.wallet.add(METAMASK_PRIV_KEY);
    const contract = new web3.eth.Contract(
      ReferralAbi,
      REFERRAL_CONTRACT_ADDRESS[chain_id],
      {
        from: SERVICE_WALLET_ADDRESS[chain_id],
      }
    );
    const gasEstimate = await contract.methods
      .addBalances(addresses, amount)
      .estimateGas({ from: SERVICE_WALLET_ADDRESS[chain_id] });

    const gasLimit = Math.ceil(gasEstimate * 1.1);
    await contract.methods.addBalances(addresses, amount).send({
      from: SERVICE_WALLET_ADDRESS[chain_id],
      gasLimit: gasLimit,
    });
  } catch (e) {
    throw e;
  }
};

class AdminPanel {
  async login(req, res) {
    const { username, password, captcha } = req.body;
    let allow = false;
    let accessToken;
    let manager;

    // const isCaptchaValid = await verifyCaptchaToken(captcha);
    // if (!isCaptchaValid) {
    //   res.status(401).send('invalid CAPTCHA token');
    //   return;
    // }

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

    const { ids, tx } = req.body;
    try {
      const orders = await db.models.Order.findAll({ where: { id: ids } });
      for (const order of orders) {
        const { USDCToPay, BaseToPay } = await calculatePayouts(order);
        await db.models.Order.update(
          {
            order_complete: true,
            status: 'approved',
            settlement_date: new Date(),
            payout_usdc: USDCToPay,
            payout_base: BaseToPay,
            payout_tx: tx,
          },
          { where: { id: order.id } }
        );

        try {
          const days = getDaysDifference(order.createdAt);
          await createTimeOnPlatform(order.from, days);
        } catch (e) {
          console.log(e);
          console.log('While adding user points history error');
        }

        try {
          const orderDB = await db.models.Order.findOne({
            where: { id: order.id },
          });
          const orderAttempt = await db.models.OrderAttempt.findOne({
            where: { id: orderDB.attempt_id },
          });
          if (!orderAttempt)
            throw new Error('Order attempt not found while sending email');
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
            const html = getDealExpirationBody(subscription, orderDB);
            await sendMail([orderDB.subscription.email], subject, '', html);
          }
        } catch (e) {
          console.log(e);
          console.log('Send email error');
        }
      }
      try {
        const referralPayout = await getExpirationReferralPayout(orders);
        await addReferralBalance(referralPayout);
        for (const order of orders) {
          await db.models.ReferralPayout.update(
            { paid: true },
            { where: { order_id: order.id } }
          );
        }
      } catch (e) {
        console.log('While adding referral contract balance error', e);
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
      _order = 'ASC',
      _sort = 'id',
      execute_date,
      order_executed,
      order_complete,
      chain_id,
      token_symbol,
      _start,
      _end,
    } = req.query;

    let where = order_complete ? { order_complete } : {};
    where = chain_id ? { ...where, chain_id } : where;
    where = token_symbol ? { ...where, token_symbol } : where;
    let orders = await db.models.Order.findAndCountAll({
      where,
      order: [[_sort, _order]],
    });

    orders = await customFilters(orders, {
      execute_date,
      order_executed,
    });
    orders = await setExtraFields(orders);
    orders = await spliceForPagination(orders, { _start, _end });

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

  async getSubscription(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });

    const { _order = 'ASC', _sort = 'id', news, _start, _end } = req.query;

    const where = news ? { news } : {};
    let userSubscriptions = await db.models.UserSubscription.findAndCountAll({
      where,
      order: [[_sort, _order]],
    });

    userSubscriptions = await spliceForPagination(userSubscriptions, {
      _start,
      _end,
    });

    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    res.setHeader('X-Total-Count', userSubscriptions.count);

    return res.status(200).send(userSubscriptions.rows);
  }
  async updateSubscription(req, res) {
    const managerId = await session.getManagerId(req);
    if (isEmpty(managerId))
      return res.json({
        success: false,
        data: null,
        error: 'Access denied',
      });
    const logId = await writeLog({
      action: 'updateUserSubscription',
      status: 'in progress',
      req,
    });
    const userSubscription = req.body;

    try {
      const { id } = userSubscription;
      await db.models.UserSubscription.update(
        { ...userSubscription },
        { where: { id } }
      );
      res.json({
        success: true,
        data: userSubscription,
        message: 'User subscription was updated',
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
    let users = await db.models.User.findAndCountAll({
      order: [[_sort, _order]],
    });
    for (const user of users.rows) {
      if (!user.nick_name) user.nick_name = 'unknown';
      if (!user.ref_fee) user.ref_fee = REF_FEE;
    }
    users = await spliceForPagination(users, { _start, _end });

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
        let ref_fee = 0;
        if (parent && parent.ref_fee) ref_fee = parent.ref_fee;
        else ref_fee = REF_FEE || 0;
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
