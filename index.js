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
app.crud('/api/user_crud', model.User);
app.crud('/api/referral_payout_crud', model.ReferralPayout);
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
          const orderAttempts = await db.models.OrderAttempt.findAll({
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
          for (const orderAttempt of orderAttempts) {
            await db.models.OrderAttempt.destroy({
              where: { id: orderAttempt.id },
            });
          }
        } catch (e) {
          console.log(e);
        }
      }, 86400000);
    });
  })
  .catch((e) => console.log(e));
