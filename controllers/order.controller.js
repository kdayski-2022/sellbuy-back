const axios = require('axios');
const dotenv = require('dotenv');
const Web3 = require('web3');
const db = require('../database');
const {
  buy_data,
  sell_data,
  get_index_price,
} = require('../config/requestData.json');
const {
  getDaysDifference,
  getValidDays,
  getTimestamp,
} = require('../lib/dates');
const { getAccessToken } = require('../lib/auth');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const { USER_COMMISSION } = require('../config/constants.json');
const {
  calculatePayouts,
  getPayin,
  getContractText,
  getContractHtml,
} = require('../lib/order');
const { getSubject, getDealExpirationBody, sendMail } = require('../lib/email');
const { INFURA_PROVIDERS } = require('../config/infura');
dotenv.config();
const apiUrl = process.env.API_URL;
const dbEnv = process.env.DB_ENV;

const getCurrentPrice = async () => {
  try {
    const { data } = await axios.get(
      `${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`
    );
    return data.result[0].estimated_delivery_price;
  } catch (e) {
    console.log(e);
    return 0;
  }
};

const setExtraFields = async (orders) => {
  try {
    let currentPrice = await getCurrentPrice();
    if (currentPrice) {
      orders.rows = await Promise.all(
        orders.rows.map(async (order) => {
          if (new Date() > order.execute_date)
            currentPrice = order.end_index_price;
          let { ETHToPay, USDCToPay, order_executed, payout_currency } =
            await calculatePayouts({
              ...order,
              end_index_price: currentPrice,
            });

          let payout_calculation_usdc,
            payout_calculation_eth = null;
          if (payout_currency === 'USDC') payout_calculation_usdc = USDCToPay;
          if (payout_currency === 'ETH') payout_calculation_eth = ETHToPay;

          const app_revenue =
            Math.round(
              (order.recieve / order.commission) * (1 - order.commission) * 100
            ) / 100;

          order.payout_calculation_usdc = payout_calculation_usdc;
          order.payout_calculation_eth = payout_calculation_eth;
          if (new Date() > order.execute_date) {
            order.order_executed_calculation = order.order_executed;
          } else {
            order.order_executed_calculation = order_executed;
          }
          order.payout_currency = payout_currency;
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
      let currentPrice = await getCurrentPrice();
      if (currentPrice) {
        const result = [];
        for (const order of orders.rows) {
          let order_executed;
          if (new Date() > order.execute_date) {
            order_executed = order.order_executed;
          } else {
            const calculate = await calculatePayouts({
              ...order,
              end_index_price: currentPrice,
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

class OrderController {
  async getOrders(req, res) {
    await checkSession(req);

    const {
      _end = 10,
      _order = 'ASC',
      _sort = 'id',
      _start = 0,
      execute_date,
      order_executed,
      order_complete,
      chain_id,
    } = req.query;

    let where = order_complete ? { order_complete } : {};
    where = chain_id ? { ...where, chain_id } : where;
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

  async getOrder(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getOrder',
      status: 'in progress',
      sessionInfo,
      req,
    });
    axios
      .get(
        `${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`
      )
      .then(async (apiRes) => {
        try {
          const { period, price, amount } = req.query;
          const direction = req.headers['direction-type'];

          const filteredTypes = apiRes.data.result.filter((item) => {
            const typesArray = item.instrument_name.split('-');
            const type = typesArray[typesArray.length - 1];
            return direction === 'sell' ? type === 'C' : type === 'P';
          });

          const filteredPrices = filteredTypes.filter((item) => {
            const priceArray = item.instrument_name.split('-');
            const instrument_price = priceArray[priceArray.length - 2];
            return instrument_price === price;
          });

          const fillteredDates = filteredPrices.filter((item) => {
            const [_, stortedDataUnderlying_index] =
              item.instrument_name.split('-');
            const targetPeriod = Date.parse(stortedDataUnderlying_index);
            const daysDifference = getDaysDifference(period);
            const validDays = getValidDays(daysDifference, targetPeriod);
            const choosenDay = new Date(Number(period)).getDate();
            const choosenMonth = new Date(Number(period)).getMonth();
            const targetMonth = new Date(getTimestamp(targetPeriod)).getMonth();
            if (validDays.includes(choosenDay) && choosenMonth === targetMonth)
              return item;
          });

          // Bid price is not stable

          // ! ONLY FOR DEV
          // const bidPriceAvailable = fillteredDates.map((item) =>
          //   item.bid_price ? item : { ...item, bid_price: Math.random() / 10 }
          // );

          const bidPriceAvailable = fillteredDates.filter(
            (item) => item.bid_price
          );

          if (!bidPriceAvailable.length) throw new Error("Order wasn't found");

          const maxBidPriceObj = bidPriceAvailable
            .sort((a, b) =>
              a.bid_price > b.bid_price ? 1 : b.bid_price > a.bid_price ? -1 : 0
            )
            .reverse()[0];
          const { estimated_delivery_price, bid_price } = maxBidPriceObj;
          const user = await db.models.User.findOne({
            where: { address: sessionInfo.userAddress.toLowerCase() },
          });
          let commission = USER_COMMISSION;
          if (user) commission = user.commission;
          const recieve =
            estimated_delivery_price * bid_price * Number(amount) * commission;
          const start_index_price = await getCurrentPrice();
          let order = {
            ...maxBidPriceObj,
            recieve,
            amount: Number(amount),
            price: Number(price),
            period: Number(period),
            execute_date: new Date(Number(period)),
            start_index_price,
            direction,
          };
          const contract_html = getContractHtml(order);
          const contract_text = getContractText(order);

          updateLog(logId, { status: 'success' });
          res.json({
            success: true,
            data: {
              ...order,
              contract_html,
              contract_text,
            },
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
      });
  }

  async postOrder(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'postOrder',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { amount, price, period, orderData, address, hash, chain_id } =
      req.body;
    const direction = req.headers['direction-type'];
    const { instrument_name, estimated_delivery_price, bid_price } = orderData;
    const postData = direction === 'sell' ? sell_data : buy_data;
    postData.params.instrument_name = instrument_name;
    postData.params.amount = Number(amount);

    try {
      direction === 'sell'
        ? telegram.send(`User ${address} deposited ${amount} ETH`)
        : telegram.send(
            `User ${address} deposited ${Number(amount) * Number(price)} USDC`
          );
      const web3 = new Web3(INFURA_PROVIDERS[chain_id]);

      const user = await db.models.User.findOne({
        where: { address: address.toLowerCase() },
      });
      let commission = USER_COMMISSION;
      if (user) commission = user.commission;

      const transactionReceipt = await web3.eth.getTransactionReceipt(hash);
      const status = transactionReceipt && transactionReceipt.status;
      const recieve =
        estimated_delivery_price * bid_price * Number(amount) * commission;

      // post order
      if (status) {
        await db.models.Order.create({
          from: address.toLowerCase(),
          user_payment_tx_hash: hash,
          amount,
          price,
          order_complete: false,
          payment_complete: status ? true : false,
          instrument_name,
          execute_date: period,
          recieve,
          status: 'pending',
          direction,
        });
        const accessToken = await getAccessToken();

        const { data } = await axios.post(apiUrl, postData, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const indexPriceData = await axios.post(apiUrl, get_index_price);

        const order_id =
          data && data.result && data.result.order && data.result.order.order_id
            ? data.result.order.order_id
            : null;
        const order =
          data && data.result && data.result.order
            ? JSON.stringify(data.result.order)
            : {};
        const start_index_price =
          indexPriceData &&
          indexPriceData.data &&
          indexPriceData.data.result &&
          indexPriceData.data.result.index_price
            ? indexPriceData.data.result.index_price
            : null;

        await db.models.Order.update(
          {
            status: 'created',
            order_id,
            order,
            target_index_price: price,
            start_index_price,
          },
          { where: { user_payment_tx_hash: hash } }
        );

        telegram.send(
          `Order was made by user ${address}\n${data?.result?.order?.instrument_name}`
        );

        const orders = await db.models.Order.findAll({
          where: { from: address.toLowerCase() },
        });
        res.json({
          success: true,
          data: { orders, order_id },
          message: 'Order was made',
          sessionInfo,
        });
        updateLog(logId, { status: 'success' });
      } else {
        res.json({
          success: false,
          data: null,
          error: 'Transaction was not mined',
          sessionInfo,
        });
        updateLog(logId, {
          status: 'failed',
          error: 'Transaction was not mined',
        });
      }
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      telegram.send(
        `Order ${instrument_name} creation failed by user ${address}\n${JSON.stringify(
          e?.response?.data?.error
        )}`
      );
      res.json({
        success: false,
        data: null,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }

  async updateOrder(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'updateOrder',
      status: 'in progress',
      sessionInfo,
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
        sessionInfo,
      });
      updateLog(logId, { status: 'success' });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        data: null,
        error: parseError(e),
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
    const direction = req.headers['direction-type'];
    try {
      const orders = await db.models.Order.findAll({
        where: {
          from: userAddress.toLowerCase(),
          direction,
          status: {
            [db.Op.ne]: 'pending',
          },
        },
      });
      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: orders, sessionInfo });
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

  async getExpirationPrediction(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getExpirationPrediction',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { all } = req.query;
    try {
      const now = new Date();
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(now.getDate() + 7);
      const and = [
        { execute_date: { [db.Op.gte]: now } },
        { order_complete: false },
        { smart_contract: true },
      ];
      if (!all) and.push({ execute_date: { [db.Op.lt]: sevenDaysLater } });
      let orders = await db.models.Order.findAll({
        where: { [db.Op.and]: and },
      });
      let lastChainId = 1;
      let web3 = new Web3(INFURA_PROVIDERS[dbEnv === 'production' ? 1 : 80001]);
      const end_index_price = await getCurrentPrice();
      for (const order of orders) {
        if (order.chain_id !== lastChainId) {
          lastChainId = order.chain_id;

          web3 = new Web3(INFURA_PROVIDERS[order.chain_id]);
        }
        const { ETHToPay, USDCToPay, payout_currency, order_executed } =
          await calculatePayouts({ ...order, end_index_price });
        if (payout_currency === 'USDC') {
          order.payout = USDCToPay;
        }
        if (payout_currency === 'ETH') {
          order.payout = ETHToPay;
        }
        order.payout_currency = payout_currency;
        order.order_executed = order_executed;
        order.payin = await getPayin(web3, order);
      }
      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: orders, sessionInfo });
    } catch (e) {
      console.log(e);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        data: null,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }

  async getExpiration(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getExpiration',
      status: 'in progress',
      sessionInfo,
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
        INFURA_PROVIDERS[dbEnv === 'production' ? 1 : 80001]
      );
      for (const order of orders) {
        if (lastChainId !== order.chain_id) {
          lastChainId = order.chain_id;
          web3 = await new Web3(INFURA_PROVIDERS[order.chain_id]);
        }
        const { ETHToPay, USDCToPay, payout_currency } = await calculatePayouts(
          order
        );
        if (payout_currency === 'USDC') {
          order.payout = USDCToPay;
        }
        if (payout_currency === 'ETH') {
          order.payout = ETHToPay;
        }
        order.payin = await getPayin(web3, order);
      }
      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: orders, sessionInfo });
    } catch (e) {
      console.log(e);
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        data: null,
        error: e?.response?.data?.error?.message,
        sessionInfo,
      });
    }
  }

  async postExpiration(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'postExpiration',
      status: 'in progress',
      sessionInfo,
      req,
    });

    const { orders, tx } = req.body;
    try {
      for (const order of orders) {
        let payout_usdc, payout_eth;
        // TODO decimals
        if (order.payout_currency === 'ETH') {
          payout_usdc = (order.payout * order.end_index_price).toFixed(6);
          payout_eth = parseFloat(order.payout).toFixed(18);
        }
        if (order.payout_currency === 'USDC') {
          payout_usdc = parseFloat(order.payout).toFixed(6);
          payout_eth = (order.payout / order.end_index_price).toFixed(18);
        }
        await db.models.Order.update(
          {
            order_complete: true,
            status: 'approved',
            settlement_date: new Date(),
            payout_usdc,
            payout_eth,
            payout_tx: tx,
          },
          { where: { id: order.id } }
        );

        try {
          const orderDB = await db.models.Order.findOne({
            where: { order_id: order.order_id },
          });

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
            if (dbEnv === 'development')
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
        data: order,
        message: 'Orders was updated',
        sessionInfo,
      });
      updateLog(logId, { status: 'success' });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({
        success: false,
        data: null,
        error: parseError(e),
        sessionInfo,
      });
    }
  }
}

module.exports = new OrderController();
