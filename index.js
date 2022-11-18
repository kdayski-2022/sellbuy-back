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
const { getAccessToken } = require('./lib/auth');
const { get_order, get_index_price } = require('./config/requestData.json');
const Transfer = require('./lib/transfer');
const Web3 = require('web3');
const crud = require('./lib/express-crud');
const { smartRound, parseError } = require('./lib/lib');
const { writeLog, updateLog, destroyLog } = require('./lib/logger');

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
    app.listen(PORT, async () => {
      console.log(`listen on port ${PORT}`);

      // try {
      // 	const res = await axios.post('http://dev.fanil.ru:5211/api/order', {"hash":"0xb0cb76dad9c584fef02f6c7b84bc88549a383616cce69872e864fc6093778d63","amount":"14","price":1100,"period":1668153610000,"orderData":{"volume":3636,"underlying_price":1240.08,"underlying_index":"ETH-11NOV22","quote_currency":"ETH","price_change":3800,"open_interest":4138,"mid_price":0.01975,"mark_price":0.020135,"low":0.0005,"last":0.0195,"interest_rate":0,"instrument_name":"ETH-11NOV22-1100-P","high":0.0195,"estimated_delivery_price":1241.09,"creation_timestamp":1667985120791,"bid_price":0.0195,"base_currency":"ETH","ask_price":0.02,"recieve":237.17229899999998,"amount":14,"price":1100,"period":1668153610000},"address":"0x302880A673b325bCA324CE3815a7dFC34D4cc6d6","direction":"buy"}, {
      // 		headers: {
      // 		  'Accept':'application/json',
      // 		  'Content-Type': 'application/json',
      // 		  'Direction-Type': 'buy',
      // 		  'Session-Token': '0490ee498ada705deb363a8946c78f37ffcaba341135179f655d5ac735a97d02',
      // 		  'User-Address': '0x302880A673b325bCA324CE3815a7dFC34D4cc6d6'
      // 		},

      // 	  })
      // 	console.log(res)
      // } catch(e) {
      // 	console.log(e)
      // }

      // ! auto payment complete
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
          const accessToken = await getAccessToken();

          let orders = await db.models.Order.findAll({
            where: {
              [db.Op.and]: [
                { execute_date: { [db.Op.lte]: new Date() } },
                { order_complete: false },
                { status: { [db.Op.notIn]: ['approved', 'denied'] } },
                // { autopay: false }
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
              if (orderDetails && order.order_id) {
                get_order.params.order_id = order.order_id;
                const { data } = await axios.post(apiUrl, get_order, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                const orderFrashData = data?.result.length
                  ? data?.result[0]
                  : {};
                const executed =
                  orderFrashData.state === 'filled' ||
                  orderFrashData.order_state === 'filled';
                if (executed) {
                  if (order.status !== 'pending_approve') {
                    const indexPriceData = await axios.post(
                      apiUrl,
                      get_index_price
                    );
                    await db.models.Order.update(
                      {
                        status: 'pending_approve',
                        end_index_price:
                          indexPriceData?.data?.result?.index_price,
                      },
                      { where: { order_id: order.order_id } }
                    );
                    const orderUpdated = await db.models.Order.findOne({
                      attributes: { exclude: ['perpetual'] },
                      where: { order_id: order.order_id },
                    });

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
  })
  .catch((e) => console.log(e));
