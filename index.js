const express = require('express');
const axios = require('axios');
const Telegram = require('./lib/telegram');
const telegram = new Telegram();
global.telegram = telegram;
const useRouter = require('./rotes/router');
const dotenv = require('dotenv');
const cors = require('cors');
const db = require('./database');
const model = require('./lib/modelWrapper')(db.models);
const { get_index_price } = require('./config/requestData.json');
const Transfer = require('./lib/transfer');
const Web3 = require('web3');
const crud = require('./lib/express-crud');
const { smartRound, parseError } = require('./lib/lib');
const { writeLog, updateLog, destroyLog } = require('./lib/logger');

const { Socket } = require('./socket');
const { postOrder, approve } = require('./lib/order');
const { checkState } = require('./lib/state');

dotenv.config();

const infuraRpc = process.env.INFURA_RPC;
const apiUrl = process.env.API_URL;
const PORT = process.env.PORT || 8080;

const web3 = new Web3(infuraRpc);

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
                { status: { [db.Op.notIn]: ['approved', 'denied'] } },
              ],
            },
          });

          orders.forEach(async (order) => {
            const logId = await writeLog({
              action: 'system auto order complete',
              status: 'in progress',
            });
            try {
              const orderDetails = JSON.parse(order.order)
                ? JSON.parse(order.order)
                : null;
              if (
                orderDetails &&
                order.order_id &&
                order.status !== 'pending_approve'
              ) {
                const indexPriceData = await axios.post(
                  apiUrl,
                  get_index_price
                );
                await db.models.Order.update(
                  {
                    status: 'pending_approve',
                    end_index_price: indexPriceData?.data?.result?.index_price,
                  },
                  { where: { order_id: order.order_id } }
                );
                const orderUpdated = await db.models.Order.findOne({
                  attributes: { exclude: ['perpetual'] },
                  where: { order_id: order.order_id },
                });

                if (orderUpdated.autopay) {
                  const { order_id, from } = orderUpdated;
                  const { status, message } = await approve(order_id);
                  console.log({ status, message });
                  if (status === 'success') {
                    telegram.send(
                      `Autopayment successfully completed\n${message}\nto: ${from}\norder id: ${order_id}`
                    );
                    await updateLog(logId, { status });
                  } else {
                    telegram.send(
                      `Autopayment completed with error\n${message}`
                    );
                    console.log(message);
                    await updateLog(logId, {
                      status,
                      error: JSON.stringify(message),
                    });
                  }
                }
                if (!orderUpdated.autopay) {
                  let recieve;
                  if (order.direction === 'sell') {
                    if (
                      orderUpdated.end_index_price >=
                      orderUpdated.target_index_price
                    ) {
                      recieve = `${
                        parseFloat(orderUpdated.price) *
                          parseFloat(orderUpdated.amount) +
                        parseFloat(orderUpdated.recieve)
                      } USDC`;
                    } else {
                      const BN = web3.utils.BN;
                      const valueWei = await web3.utils.toWei(
                        String(
                          parseFloat(orderUpdated.amount) +
                            parseFloat(orderUpdated.recieve) /
                              parseFloat(orderUpdated.end_index_price)
                        ),
                        'ether'
                      );
                      recieve = `${Number(
                        web3.utils.fromWei(new BN(valueWei))
                      )} ETH`;
                    }
                  } else {
                    if (
                      orderUpdated.end_index_price <=
                      orderUpdated.target_index_price
                    ) {
                      recieve = `${
                        smartRound(
                          parseFloat(orderUpdated.recieve) /
                            parseFloat(orderUpdated.end_index_price)
                        ) + orderUpdated.amount
                      } ETH`;
                    } else {
                      recieve = `${
                        parseFloat(orderUpdated.price) *
                          parseFloat(orderUpdated.amount) +
                        parseFloat(orderUpdated.recieve)
                      } USDC`;
                    }
                  }
                  telegram.sendApprove(
                    `Confirm the payment which you're about to make.\n${
                      orderUpdated.from
                    } will recieve ${recieve}\n\n${JSON.stringify(
                      orderUpdated
                    )}`,
                    orderUpdated
                  );
                  return;
                }
              }
            } catch (e) {
              await updateLog(logId, {
                status: 'failed',
                error: parseError(e),
              });
            }
          });
        } catch (e) {
          console.log(e);
        }
      }, 10000);
    });
    // }
    // }, 10);
  })
  .catch((e) => console.log(e));
