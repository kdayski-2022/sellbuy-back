const express = require('express');
const Telegram = require('./lib/telegram');
const telegram = new Telegram();
global.telegram = telegram;
const useRouter = require('./rotes/router');
const dotenv = require('dotenv');
const cors = require('cors');
const db = require('./database');
const model = require('./lib/modelWrapper')(db.models);
const Web3 = require('web3');
const crud = require('./lib/express-crud');

const { Socket } = require('./socket');
const { postOrder } = require('./lib/order');
const { checkState } = require('./lib/state');
const { listenForPayout, resetOrders } = require('./lib/payoutListener');
const { formatTime, formatDate } = require('./lib/dates');
const { default: axios } = require('axios');
const { INFURA_PROVIDERS } = require('./config/infura');

dotenv.config();

const AUTOPAY_INTERVAL = process.env.AUTOPAY_INTERVAL;
const DB_ENV = process.env.DB_ENV;

const PORT = process.env.PORT || 8080;

let web3 = new Web3(INFURA_PROVIDERS[DB_ENV === 'production' ? 1 : 80001]);

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
              let order_hedged = data.order_hedged;
              if (data.amount < 1) order_hedged = true;
              let { order_id, error } = await postOrder({
                ...data,
                order_hedged,
              });
              if (data.amount < 1) order_id = 'hedging';
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

          let lastChainId = 1;
          orders.forEach(
            async ({ user_payment_tx_hash, order_id, chain_id }) => {
              if (user_payment_tx_hash && order_id) {
                if (lastChainId !== chain_id) {
                  lastChainId = chain_id;
                  web3 = new Web3(INFURA_PROVIDERS[chain_id]);
                }
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
            }
          );
        } catch (e) {
          console.log(e);
        }
      }, 10000);

      // const orders = await db.models.Order.findAll({
      //   where: { status: 'pending_approve' },
      // });
      // try {
      //   const res = await axios.post(
      //     'http://dev.fanil.ru:5111/api/expiration',
      //     {
      //       orders,
      //       tx: '0x022b935c8ae6e92ca72903d73e2ef48e573d83cd037cfc25aec927105d3c274c',
      //     },
      //     {
      //       headers: {
      //         Accept: 'application/json',
      //         'Content-Type': 'application/json',
      //       },
      //     }
      //   );
      //   console.log(res);
      // } catch (e) {
      //   console.log(e);
      // }
      // resetOrders();
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

          if (orders && orders.length) {
            await listenForPayout(orders);
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
