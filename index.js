const express = require('express');
const Telegram = require('./lib/telegram');
const telegram = new Telegram();
global.telegram = telegram;
const useRouter = require('./rotes/router');
const dotenv = require('dotenv');
const cors = require('cors');
const db = require('./database');
const model = require('./lib/modelWrapper')(db.models);
const Transfer = require('./lib/transfer');
const Payout = require('./lib/payout');
const Web3 = require('web3');
const crud = require('./lib/express-crud');

const { Socket } = require('./socket');
const { postOrder } = require('./lib/order');
const { checkState } = require('./lib/state');
const {
  listenForPayout,
  createPayoutData,
  resetOrders,
} = require('./lib/payoutListener');
const { destroyLog } = require('./lib/logger');
const { default: axios } = require('axios');

dotenv.config();

const infuraRpc = process.env.INFURA_RPC;
const AUTOPAY_INTERVAL = process.env.AUTOPAY_INTERVAL;
const PORT = process.env.PORT || 8080;

const web3 = new Web3(infuraRpc);

const payout = new Payout();
payout.init();
const transfer = new Transfer();
transfer.init();
const app = express();
crud(app);
app.use(cors());
app.use(express.json());
app.use('/api', useRouter);
app.crud('/api/order_crud', model.Order);
app.crud('/api/log_crud', model.Log);

db.connection
  .sync({ alter: true })
  .then(async () => {
    new Socket();

    //! если запущено 2 бека, при подтверждении дубликата проверять исполнена ли уже транзакция
    // const interval = setInterval(() => {
    // if (new Date().getTime() > 1671443978862 + 80000) {
    // clearInterval(interval);
    app.listen(PORT, async () => {
      console.log(`listen on port ${PORT}`);
      //? BEST APR
      // const request = async (url, direction) => {
      //   return await axios.get(url, {
      //     headers: {
      //       Accept: 'application/json',
      //       'Content-Type': 'application/json',
      //       'Direction-Type': direction,
      //       'Session-Token':
      //         '5e845ac00f50a16c226b06c519d4205b54ff45ded7fb714b91f7dd5971de60e1',
      //       'User-Address': '0x05528440b9e0323d7ccb9baf88b411ce481694a0',
      //     },
      //   });
      // };

      // const aprSniff = async (prices, direction) => {
      //   const result = [];
      //   for (price of prices) {
      //     const {
      //       data: {
      //         data: { periods },
      //       },
      //     } = await request(
      //       `https://api.dev.sell-high.io/api/periods_price?price=${price}&amount=1`,
      //       direction
      //     );
      //     for (period of periods) {
      //       if (period.apr) {
      //         result.push({ ...period, direction });
      //       }
      //     }
      //   }
      //   return result;
      // };

      // const buyPrices = await request(
      //   'https://api.dev.sell-high.io/api/prices/buy',
      //   'buy'
      // );
      // const sellPrices = await request(
      //   'https://api.dev.sell-high.io/api/prices/sell',
      //   'sell'
      // );
      // const buyAprs = await aprSniff(buyPrices.data.data.prices, 'buy');
      // const sellAprs = await aprSniff(sellPrices.data.data.prices, 'sell');
      // const periodsApr = [...buyAprs, ...sellAprs];
      // const largestApr = periodsApr.reduce(function (prev, current) {
      //   return prev.apr > current.apr ? prev : current;
      // });
      // console.log(largestApr);
      // const mostProfitOrder = await request(
      //   `https://api.dev.sell-high.io/api/order?price=${largestApr.price}&period=${largestApr.period}&amount=1`,
      //   largestApr.direction
      // );
      // console.log(mostProfitOrder.data);

      // ! auto order attempt payment status
      setInterval(async () => {
        try {
          const orderAttempts = await db.models.OrderAttempt.findAll({
            where: {
              [db.Op.and]: [
                { payment_complete: false },
                { order_published: false },
                {
                  hash: {
                    [db.Op.ne]: null,
                  },
                },
                {
                  error: {
                    [db.Op.is]: null,
                  },
                },
              ],
            },
          });

          orderAttempts.forEach(async ({ id, ...data }) => {
            if (data && data.hash) {
              const state = await checkState({
                ...data,
                id,
              });
              await db.models.OrderAttempt.update(
                {
                  ...state,
                },
                { where: { id } }
              );
            }
          });
        } catch (e) {
          console.log(e);
        }
      }, 10000);

      // ! auto order attempt order post
      setInterval(async () => {
        try {
          const orderAttempts = await db.models.OrderAttempt.findAll({
            where: {
              [db.Op.and]: [
                { payment_complete: true },
                { order_published: false },
                {
                  order_id: {
                    [db.Op.is]: null,
                  },
                },
                {
                  error: {
                    [db.Op.is]: null,
                  },
                },
              ],
            },
          });

          orderAttempts.forEach(async ({ id, ...data }) => {
            if (data && data.instrument_name) {
              const { order_id, error } = await postOrder(data);
              const state = await checkState({ ...data, id, order_id, error });
              await db.models.OrderAttempt.update(
                { ...state, order_id, error },
                { where: { id } }
              );
            }
          });
        } catch (e) {
          console.log(e);
        }
      }, 10000);

      // ! auto order payment complete
      setInterval(async () => {
        try {
          const orders = await db.models.Order.findAll({
            where: {
              [db.Op.and]: [
                { execute_date: { [db.Op.gt]: new Date() } },
                { payment_complete: false },
              ],
            },
          });

          orders.forEach(async ({ user_payment_tx_hash, order_id }) => {
            if (user_payment_tx_hash && order_id) {
              const { status } = await web3.eth.getTransactionReceipt(
                user_payment_tx_hash
              );
              if (status) {
                await db.models.Order.update(
                  { payment_complete: true },
                  { where: { order_id } }
                );
              }
            }
          });
        } catch (e) {
          console.log(e);
        }
      }, 10000);

      // try {
      // await resetOrders();
      //   let orders = await db.models.Order.findAll({
      //     where: {
      //       [db.Op.and]: [
      //         { execute_date: { [db.Op.lte]: new Date() } },
      //         { order_complete: false },
      //         { status: { [db.Op.notIn]: ['approved', 'denied', 'broken'] } },
      //       ],
      //     },
      //   });
      //   const payoutData = await createPayoutData(orders);

      //   console.log(payoutData)
      //   // await payout.create(payoutData)
      //   // telegram.send(payoutData);
      // } catch (e) {
      //   console.log(e);
      // }

      // ! auto order complete
      setInterval(async () => {
        try {
          let orders = await db.models.Order.findAll({
            where: {
              [db.Op.and]: [
                { execute_date: { [db.Op.lte]: new Date() } },
                { order_complete: false },
                { status: { [db.Op.notIn]: ['approved', 'denied', 'broken'] } },
              ],
            },
          });

          for (const order of orders) {
            await listenForPayout(order);
          }
        } catch (e) {
          console.log(e);
        }
      }, AUTOPAY_INTERVAL);

      // ! auto logs and sessions clean
      setInterval(async () => {
        try {
          const monthAgo = new Date(
            new Date().setMonth(new Date().getMonth() - 1)
          );
          const logs = await db.models.Log.findAll({
            where: {
              createdAt: {
                [db.Op.lt]: monthAgo,
              },
            },
          });
          const sessions = await db.models.UserSession.findAll({
            where: {
              createdAt: {
                [db.Op.lt]: monthAgo,
              },
            },
          });

          for (const log of logs) {
            await db.models.Log.destroy({ where: { id: log.id } });
          }
          for (const session of sessions) {
            await db.models.UserSession.destroy({ where: { id: session.id } });
          }
        } catch (e) {
          console.log(e);
        }
      }, 6000000);
    });
    // }
    // }, 10);
  })
  .catch((e) => console.log(e));
