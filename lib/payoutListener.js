const axios = require('axios');
const Web3 = require('web3');
const db = require('../database');
const { parseError } = require('./lib');
const { writeLog, updateLog } = require('./logger');
const { calculatePayouts } = require('./order');
const { get_index_price } = require('../config/requestData.json');
const Transfer = require('./transfer');
const Payout = require('./payout');
const { INFURA_PROVIDERS } = require('../config/infura');
const { CHAIN_LIST } = require('../config/network');

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
    const end_index_price = await fetchIndexPrice(orders);
    const payoutData = await createPayoutData(orders, end_index_price, logId);
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
      initPayoutData[chain_id] = [[], [], [], []];
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
const createPayoutData = async (orders, end_index_price) => {
  try {
    const payoutData = {};
    for (const chain_id of CHAIN_LIST) {
      payoutData[chain_id] = [[], [], [], []];
    }
    const usdcDecimals = 6;
    const ethDecimals = 18;
    let lastChainId = 1;
    for (const order of orders) {
      if (lastChainId !== order.chain_id) {
        lastChainId = order.chain_id;
        web3 = new Web3(INFURA_PROVIDERS[order.chain_id]);
      }
      const orderDetails = JSON.parse(order.order)
        ? JSON.parse(order.order)
        : null;
      if (
        ((orderDetails && order.order_id) || order.order_hedged) &&
        order.status !== 'pending_approve'
      ) {
        const { order_executed, payout_currency } = await calculatePayouts({
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
        await appendPayoutData(
          orderUpdated,
          usdcDecimals,
          ethDecimals,
          payoutData
        );
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
  usdcDecimals,
  ethDecimals,
  payoutData
) => {
  if (orderUpdated.smart_contract) {
    const { chain_id } = orderUpdated;
    const transfer = new Transfer();
    transfer.init(orderUpdated.chain_id);
    const { recieveETH, recieveUSDC } = await calculateReceiveValues(
      orderUpdated,
      usdcDecimals,
      ethDecimals
    );

    if (recieveETH) {
      const recieveETHWei = await transfer.ethToWei(recieveETH);
      payoutData[chain_id][0].push(orderUpdated.from);
      payoutData[chain_id][1].push(recieveETHWei);
    }
    if (recieveUSDC) {
      const recieveUSDCWei = await transfer.usdcToWei(recieveUSDC);
      payoutData[chain_id][2].push(orderUpdated.from);
      payoutData[chain_id][3].push(recieveUSDCWei);
    }
  }
};

// Calculate receive values for ETH and USDC
const calculateReceiveValues = async (
  orderUpdated,
  usdcDecimals,
  ethDecimals
) => {
  let recieveUSDC, recieveETH;
  if (orderUpdated.direction === 'sell') {
    if (orderUpdated.end_index_price >= orderUpdated.target_index_price) {
      recieveUSDC = (
        parseFloat(orderUpdated.price) * parseFloat(orderUpdated.amount) +
        parseFloat(orderUpdated.recieve)
      ).toFixed(usdcDecimals);
    } else {
      const BN = web3.utils.BN;
      const valueWei = await web3.utils.toWei(
        (
          parseFloat(orderUpdated.amount) +
          parseFloat(orderUpdated.recieve) /
            parseFloat(orderUpdated.end_index_price)
        ).toFixed(ethDecimals),
        'ether'
      );
      recieveETH = Number(web3.utils.fromWei(new BN(valueWei)));
    }
  } else {
    if (orderUpdated.end_index_price <= orderUpdated.target_index_price) {
      recieveETH = (
        parseFloat(orderUpdated.recieve) /
          parseFloat(orderUpdated.end_index_price) +
        parseFloat(orderUpdated.amount)
      ).toFixed(ethDecimals);
    } else {
      recieveUSDC = (
        parseFloat(orderUpdated.price) * parseFloat(orderUpdated.amount) +
        parseFloat(orderUpdated.recieve)
      ).toFixed(usdcDecimals);
    }
  }
  return { recieveETH, recieveUSDC };
};

// Fetch index price
const fetchIndexPrice = async (orders) => {
  if (orders && orders.length) {
    const indexPriceData = await axios.post(apiUrl, get_index_price);
    return indexPriceData?.data?.result?.index_price;
  }
  return null;
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
          { execute_date: { [db.Op.gt]: '2023-05-20' } },
          { execute_date: { [db.Op.lt]: '2023-05-22' } },
        ],
      },
    });
    for (const order of orders) {
      await db.models.Order.update(
        {
          execute_date: '2023-05-21',
          order_complete: false,
          status: 'created',
          end_index_price: null,
          settlement_date: null,
          payout_eth: null,
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
