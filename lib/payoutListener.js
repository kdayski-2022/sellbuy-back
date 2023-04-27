const axios = require('axios');
const Web3 = require('web3');
const db = require('../database');
const { parseError } = require('./lib');
const { writeLog, updateLog } = require('./logger');
const { calculatePayouts } = require('./order');
const { get_index_price } = require('../config/requestData.json');
const Transfer = require('./transfer');
const Payout = require('./payout');
const ERC20Abi = require('../abi/ERC20.json');

const apiUrl = process.env.API_URL;
const infuraRpc = process.env.INFURA_RPC;
const dbEnv = process.env.DB_ENV;
const WITHDRAWAL_TOKEN_ADDRESS = process.env.WITHDRAWAL_TOKEN_ADDRESS;

const web3 = new Web3(infuraRpc);
const transfer = new Transfer();
const payout = new Payout();
transfer.init();
payout.init();

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
    if (JSON.stringify(payoutData) !== JSON.stringify([[], [], [], []])) {
      await payout.create(payoutData);
    }
  } catch (e) {
    handleError(e, logId);
  }
};

// Create payout data
const createPayoutData = async (orders, end_index_price) => {
  try {
    const payoutData = [[], [], [], []];
    const contract = new web3.eth.Contract(ERC20Abi, WITHDRAWAL_TOKEN_ADDRESS, {
      from: WITHDRAWAL_TOKEN_ADDRESS,
    });
    const usdcDecimals = await contract.methods.decimals().call();
    const ethDecimals = 18;

    for (const order of orders) {
      const orderDetails = JSON.parse(order.order)
        ? JSON.parse(order.order)
        : null;
      if (
        orderDetails &&
        order.order_id &&
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
        const orderUpdated = await fetchUpdatedOrder(order.order_id);
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
    const { recieveETH, recieveUSDC } = await calculateReceiveValues(
      orderUpdated,
      usdcDecimals,
      ethDecimals
    );

    if (recieveETH) {
      const recieveETHWei = await transfer.ethToWei(recieveETH);
      payoutData[0].push(orderUpdated.from);
      payoutData[1].push(recieveETHWei);
    }
    if (recieveUSDC) {
      const recieveUSDCWei = await transfer.usdcToWei(recieveUSDC);
      payoutData[2].push(orderUpdated.from);
      payoutData[3].push(recieveUSDCWei);
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
    { where: { order_id: order.order_id } }
  );
};

// Fetch updated order
const fetchUpdatedOrder = async (orderId) => {
  return await db.models.Order.findOne({
    where: { order_id: orderId },
  });
};

// Reset orders
const resetOrders = async () => {
  if (dbEnv === 'development') {
    let orders = await db.models.Order.findAll({
      where: {
        [db.Op.and]: [
          { execute_date: { [db.Op.gt]: '2023-04-25' } },
          { execute_date: { [db.Op.lt]: '2023-04-27' } },
        ],
      },
    });
    for (const order of orders) {
      await db.models.Order.update(
        {
          execute_date: '2023-04-26',
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
