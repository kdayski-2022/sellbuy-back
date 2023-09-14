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
const geoip = require('fast-geoip');

const { Socket } = require('./socket');
const { postOrder } = require('./lib/order');
const { checkState } = require('./lib/state');
const { listenForPayout, resetOrders } = require('./lib/payoutListener');
const { default: axios } = require('axios');
const { INFURA_PROVIDERS } = require('./config/infura');

const {
  BLOCK_EXPLORERS,
  WITHDRAWAL_TOKEN_ADDRESS,
  CHAIN_TOKENS,
  CHAIN_LIST_ENV,
  PAYOUT_CONTRACT_ADDRESS,
  PAYIN_TOKEN_ADDRESS_LIST,
  VALID_AMOUNT,
} = require('./config/network');
const Eth = require('./lib/etherscan');
const { isIterable } = require('./lib/lib');
const {
  getLogsByAction,
  formatActivityToChartData,
  updateActivities,
} = require('./lib/stats');

dotenv.config();

const AUTOPAY_INTERVAL = process.env.AUTOPAY_INTERVAL;
const DB_ENV = process.env.DB_ENV;

const PORT = process.env.PORT || 8080;

let web3 = new Web3(INFURA_PROVIDERS[DB_ENV === 'production' ? 1 : 80001]);

const app = express();
crud(app);
app.use(cors());
app.use(express.json());
app.use(async (req, res, next) => {
  const clientIP =
    req.header('X-Real-IP') || req.connection.remoteAddress || '';
  const origin = req.header('origin');
  const geo = await geoip.lookup(clientIP);
  if (
    geo.country === 'US' &&
    (origin !== 'http://localhost:5112' || origin !== 'https://tymio.com')
  ) {
    return res.status(418).json({
      code: 418,
      success: false,
      error:
        'TYMIO is not available to people or companies who are residents of, or are located, incorporated or have a registered agent in a blocked country or a restricted territory.',
    });
    // `More details can be found in our <a href="${origin}/terms" target="_blank" style="text-decoration: underline;" onMouseOut="this.style.textDecoration='underline'" onMouseOver="this.style.textDecoration='none'">Terms of Use</a>`,
  }
  next();
});
app.use('/api', useRouter);
app.crud('/api/user_crud', model.User);
app.crud('/api/referral_payout_crud', model.ReferralPayout);
app.crud('/api/order_crud', model.Order);
app.crud('/api/log_crud', model.Log);
app.crud('/api/contract_income', model.ContractIncome);

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
              if (data.amount < VALID_AMOUNT[data.token_symbol])
                order_hedged = true;
              let { order_id, error } = await postOrder({
                attempt_id: id,
                ...data,
                order_hedged,
              });
              if (data.amount < VALID_AMOUNT[data.token_symbol])
                order_id = 'hedging';
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

          const activityLogs = await getLogsByAction('getPricePeriods');
          const formattedData = formatActivityToChartData(activityLogs);
          await updateActivities(formattedData.activities);

          for (const log of logs) {
            await db.models.Log.destroy({ where: { id: log.id } });
          }
          for (const session of sessions) {
            await db.models.UserSession.destroy({ where: { id: session.id } });
          }
        } catch (e) {
          console.log(e);
        }
      }, 86400000);

      setInterval(async () => {
        // Попытка привязывается к адресу, количеству и дате
        try {
          CHAIN_LIST_ENV[DB_ENV].forEach(async (chain_id) => {
            const minute = 60;
            const hour = minute * 60;
            const day = hour * 24;
            const currentBlockNumber = await Eth.getCurrentBlockNumber(
              chain_id
            );
            const startBlock = await Eth.getBlockNumberSecondsAgo(
              chain_id,
              currentBlockNumber,
              minute * 5
            );
            const res = await Eth.getServiceTxList(
              chain_id,
              startBlock,
              currentBlockNumber
            );
            const allTransactions = [];
            isIterable(res.ethTransactions) &&
              allTransactions.push(...res.ethTransactions);
            isIterable(res.erc20Transactions) &&
              allTransactions.push(...res.erc20Transactions);
            for (const tx of allTransactions) {
              let token = PAYIN_TOKEN_ADDRESS_LIST[chain_id].find(
                (item) => item.tokenSymbol === tx.tokenSymbol
              );
              if (!token) {
                token = PAYIN_TOKEN_ADDRESS_LIST[chain_id].find(
                  (item) => item.tokenSymbol === 'ETH'
                );
              }
              if (token) {
                if (token.tokenSymbol === 'ETH') {
                  tx.valueOriginal = await Eth.ethFromWei(tx.value, chain_id);
                } else {
                  tx.valueOriginal = await Eth.tokenFromWei(
                    tx.value,
                    token.tokenAddress,
                    chain_id
                  );
                }
                tx.direction = 'sell';
                tx.tokenSymbol = token.tokenSymbol;
                tx.tokenAddress = token.tokenAddress;
                tx.chain_id = chain_id;
                tx.createdAt = new Date(Number(tx.timeStamp) * 1000);
              } else {
                // TODO Проверить работу бай лоу
                tx.valueOriginal = await Eth.tokenFromWei(
                  tx.value,
                  tx.to,
                  chain_id
                );
                tx.direction = 'buy';
                tx.tokenAddress = WITHDRAWAL_TOKEN_ADDRESS[chain_id];
                tx.chain_id = chain_id;
                tx.createdAt = new Date(Number(tx.timeStamp) * 1000);
              }
              let orderAttempt = await db.models.OrderAttempt.findOne({
                where: {
                  hash: tx.hash,
                },
              });
              if (!orderAttempt) {
                orderAttempt = await db.models.OrderAttempt.findAll({
                  where: {
                    [db.Op.and]: [
                      {
                        [db.Op.or]: [
                          { address: tx.from.toLowerCase() },
                          { address: tx.from },
                        ],
                      },
                      { hash: null },
                      { direction: tx.direction },
                      { period: { [db.Op.gt]: new Date() } },
                      { createdAt: { [db.Op.lt]: tx.createdAt } },
                      {
                        [db.Op.or]: [
                          {
                            error: {
                              [db.Op.like]:
                                '%Transaction started at%but was not mined within%',
                            },
                          },
                          { error: null },
                        ],
                      },
                    ],
                  },
                  order: [['id', 'ASC']],
                });
              } else {
                await db.models.ContractIncome.create({
                  order_attempt_id: orderAttempt.id,
                  hash: tx.hash,
                  from: tx.from,
                  amount: tx.valueOriginal,
                  token_address: tx.tokenAddress,
                  token_symbol: tx.tokenSymbol,
                  status: true,
                  chain_id: tx.chain_id,
                });
              }
              if (orderAttempt && orderAttempt.length) {
                let validAttempt;
                for (const attempt of orderAttempt) {
                  const valid =
                    tx.direction === 'sell'
                      ? attempt.amount === Number(tx.valueOriginal)
                      : attempt.amount ===
                        Number(tx.valueOriginal) / attempt.price;

                  if (valid) {
                    validAttempt = attempt;
                  }
                }
                if (validAttempt) {
                  const exists = await db.models.Order.findOne({
                    where: {
                      user_payment_tx_hash: tx.hash,
                    },
                  });
                  if (!exists) {
                    await db.models.OrderAttempt.update(
                      {
                        error: 'Transaction mined too slow',
                      },
                      { where: { id: validAttempt.id } }
                    );
                    await db.models.ContractIncome.create({
                      order_attempt_id: validAttempt.id,
                      hash: tx.hash,
                      from: tx.from,
                      amount: tx.valueOriginal,
                      token_address: tx.tokenAddress,
                      token_symbol: tx.tokenSymbol,
                      status: false,
                      chain_id: tx.chain_id,
                    });
                    telegram.send(
                      `${validAttempt.id} Order attempt has not catched hash\n${BLOCK_EXPLORERS[chain_id]}/tx/${tx.hash}`
                    );
                  }
                }
              }
            }
          });
        } catch (e) {
          console.log(e);
        }
      }, 300000);
    });
  })
  .catch((e) => console.log(e));
