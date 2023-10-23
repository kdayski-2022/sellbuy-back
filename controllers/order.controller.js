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
const { getContractText, getContractHtml } = require('../lib/order');
dotenv.config();
const apiUrl = process.env.API_URL;

const getCurrentPrice = async (tokenSymbol) => {
  try {
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    const { data } = await axios.get(
      `${apiUrl}/public/get_book_summary_by_currency?currency=${tokenSymbol}&kind=option`
    );
    return data.result[0].estimated_delivery_price;
  } catch (e) {
    console.log(e);
    return 0;
  }
};

class OrderController {
  async getOrder(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getOrder',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { period, price, amount } = req.query;
    let { tokenSymbol } = req.query;
    // TODO no such token in derebit
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    axios
      .get(
        `${apiUrl}/public/get_book_summary_by_currency?currency=${tokenSymbol}&kind=option`
      )
      .then(async (apiRes) => {
        try {
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
          const start_index_price = await getCurrentPrice(tokenSymbol);
          let order = {
            ...maxBidPriceObj,
            recieve,
            amount: Number(amount),
            price: Number(price),
            period: Number(period),
            execute_date: new Date(Number(period)),
            start_index_price,
            token_symbol: tokenSymbol,
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
}

module.exports = new OrderController();
