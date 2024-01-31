const axios = require('axios');
const Web3 = require('web3');
const db = require('../database');
const { parseError } = require('./lib');
const { writeLog, updateLog } = require('./logger');
const { calculatePayouts } = require('./order');
const { get_index_price } = require('../config/requestData.json');
const Payout = require('./payout');
const { INFURA_PROVIDERS } = require('../config/infura');
const { CHAIN_LIST, TOKEN_ADDRESS } = require('../config/network');
const Eth = require('./etherscan');

const apiUrl = process.env.API_URL;
const dbEnv = process.env.DB_ENV;

let web3 = new Web3(INFURA_PROVIDERS[dbEnv === 'production' ? 1 : 80001]);

// Main function to listen for payout
let isProcessing = false;

const listenForPayout = async (orders) => {
  if (isProcessing) return;

  isProcessing = true;
  const logId = await writeLog({
    action: 'system auto order complete',
    status: 'in progress',
  });
  try {
    const WBTC = await fetchIndexPrice('btc');
    const ETH = await fetchIndexPrice('eth');
    const payoutData = await createPayoutData(orders, { ETH, WBTC }, logId);
    await processOrders(payoutData, logId);
  } catch (e) {
    handleError(e, logId);
  } finally {
    isProcessing = false;
  }
};

// Process orders
const processOrders = async (payoutData, logId) => {
  try {
    const initPayoutData = {};
    for (const chain_id of CHAIN_LIST) {
      initPayoutData[chain_id] = [[], [], []];
    }
    if (JSON.stringify(payoutData) !== JSON.stringify(initPayoutData)) {
      const payout = new Payout();
      await payout.create(payoutData);
    }
  } catch (e) {
    handleError(e, logId);
  }
};

// Create payout data
const createPayoutData = async (orders, prices, logId) => {
  try {
    const payoutData = {};
    for (const chain_id of CHAIN_LIST) {
      payoutData[chain_id] = [[], [], []];
    }
    for (const order of orders) {
      const orderDetails = JSON.parse(order.order)
        ? JSON.parse(order.order)
        : null;
      if (
        ((orderDetails && order.order_id) || order.order_hedged) &&
        order.status !== 'pending_approve'
      ) {
        const orderDuplicates = await db.models.Order.findAll({
          where: { user_payment_tx_hash: order.user_payment_tx_hash },
        });
        if (orderDuplicates.length > 1) {
          telegram.send(`Order with this hash ${hash} already exists`);
          continue;
        }
        const end_index_price = prices[order.token_symbol];
        const { order_executed, payout_currency, USDCToPay, BaseToPay } =
          await calculatePayouts({
            ...order,
            end_index_price,
          });
        await updateOrderStatus(order, {
          end_index_price,
          order_executed,
          payout_currency,
        });
        const orderUpdated = await fetchUpdatedOrder(
          order.user_payment_tx_hash
        );
        await appendPayoutData(orderUpdated, payoutData, USDCToPay, BaseToPay);
      }
    }
    return payoutData;
  } catch (e) {
    handleError(e, logId);
  }
};

// Append payout data
const appendPayoutData = async (
  orderUpdated,
  payoutData,
  USDCToPay,
  BaseToPay
) => {
  if (orderUpdated.smart_contract) {
    const { chain_id, from, payout_currency } = orderUpdated;
    const recieveWei = await calculateReceiveWeiValues(
      orderUpdated,
      USDCToPay,
      BaseToPay,
      chain_id
    );
    payoutData[chain_id][0].push(TOKEN_ADDRESS[chain_id][payout_currency]);
    payoutData[chain_id][1].push(recieveWei);
    payoutData[chain_id][2].push(from);
  }
};

// Calculate receive values for Base token and USDC
const calculateReceiveWeiValues = async (
  orderUpdated,
  USDCToPay,
  BaseToPay,
  chain_id
) => {
  if (orderUpdated.payout_currency === 'USDC') {
    return Eth.tokenToWei(
      USDCToPay,
      TOKEN_ADDRESS[orderUpdated.chain_id]['USDC'],
      chain_id
    );
  }
  if (orderUpdated.payout_currency === 'WBTC') {
    return Eth.tokenToWei(
      BaseToPay,
      TOKEN_ADDRESS[orderUpdated.chain_id]['WBTC'],
      chain_id
    );
  }
  if (orderUpdated.payout_currency === 'ETH') {
    return Eth.ethToWei(BaseToPay, chain_id);
  }

  throw new Error('Recieve values are invalid');
};

// Fetch index price
const fetchIndexPrice = async (token) => {
  get_index_price.params.index_name = `${token}_usdc`;
  const indexPriceData = await axios.post(apiUrl, get_index_price);
  return indexPriceData?.data?.result?.index_price;
};

// Update order status
const updateOrderStatus = async (order, data) => {
  await db.models.Order.update(
    {
      status: 'pending_approve',
      ...data,
    },
    { where: { user_payment_tx_hash: order.user_payment_tx_hash } }
  );
};

// Fetch updated order
const fetchUpdatedOrder = async (user_payment_tx_hash) => {
  return await db.models.Order.findOne({
    where: { user_payment_tx_hash },
  });
};

// Reset orders
const resetOrders = async () => {
  if (dbEnv === 'development') {
    let orders = await db.models.Order.findAll({
      where: {
        [db.Op.and]: [
          { execute_date: { [db.Op.gt]: '2023-09-14' } },
          { execute_date: { [db.Op.lt]: '2023-09-30' } },
        ],
      },
    });
    for (const order of orders) {
      await db.models.Order.update(
        {
          execute_date: '2023-09-10',
          order_complete: false,
          status: 'created',
          end_index_price: null,
          settlement_date: null,
          payout_base: null,
          payout_usdc: null,
          payout_tx: null,
          order_executed: null,
          payout_currency: null,
        },
        { where: { order_id: order.order_id } }
      );
    }
  }
};

// Handle errors
const handleError = async (e, logId) => {
  console.log(parseError(e));
  await updateLog(logId, {
    status: 'failed',
    error: parseError(e),
  });
};

module.exports = { listenForPayout, resetOrders };
