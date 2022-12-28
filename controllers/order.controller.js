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
const { convertUSDCToETH, parseError } = require('../lib/lib');
dotenv.config();
const apiUrl = process.env.API_URL;
const infuraRpc = process.env.INFURA_RPC;

class OrderController {
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
      .then((apiRes) => {
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
              item.underlying_index.split('-');
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
          const recieve =
            estimated_delivery_price * bid_price * Number(amount) * 0.7;

          updateLog(logId, { status: 'success' });
          res.json({
            success: true,
            data: {
              ...maxBidPriceObj,
              recieve,
              amount: Number(amount),
              price: Number(price),
              period: Number(period),
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
    const { amount, price, period, orderData, address, hash } = req.body;
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
      const web3 = new Web3(infuraRpc);

      const transactionReceipt = await web3.eth.getTransactionReceipt(hash);
      const status = transactionReceipt && transactionReceipt.status;
      const recieve =
        estimated_delivery_price * bid_price * Number(amount) * 0.7;

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
            // perpetual
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
      const orders = await db.models.Order.findAll({
        where: {
          from: userAddress.toLowerCase(),
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
}

module.exports = new OrderController();
