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

const listenForPayout = async (orders) => {
  const logId = await writeLog({
    action: 'system auto order complete',
    status: 'in progress',
  });
  try {
    let end_index_price;
    if (orders && orders.length) {
      const indexPriceData = await axios.post(apiUrl, get_index_price);
      end_index_price = indexPriceData?.data?.result?.index_price;
    }

    const initData = [[], [], [], []];
    const payoutData = await createPayoutData(orders, end_index_price);
    if (JSON.stringify(payoutData) !== JSON.stringify(initData)) {
      await payout.create(payoutData);
    }

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
        await db.models.Order.update(
          {
            status: 'pending_approve',
            end_index_price,
            order_executed,
            payout_currency,
          },
          { where: { order_id: order.order_id } }
        );
      } else {
        await updateLog(logId, {
          status: `order ${order.order_id} in pending`,
        });
      }
    }
  } catch (e) {
    console.log(parseError(e));
    await updateLog(logId, {
      status: 'failed',
      error: parseError(e),
    });
  }
};

const createPayoutData = async (orders, end_index_price) => {
  const logId = await writeLog({
    action: 'system auto order complete',
    status: 'in progress',
  });
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
        await db.models.Order.update(
          {
            status: 'pending_approve',
            end_index_price,
          },
          { where: { order_id: order.order_id } }
        );
        const orderUpdated = await db.models.Order.findOne({
          attributes: { exclude: ['perpetual'] },
          where: { order_id: order.order_id },
        });

        if (orderUpdated.smart_contract) {
          let recieveUSDC, recieveETH;
          if (order.direction === 'sell') {
            if (
              orderUpdated.end_index_price >= orderUpdated.target_index_price
            ) {
              recieveUSDC = (
                parseFloat(orderUpdated.price) *
                  parseFloat(orderUpdated.amount) +
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
            if (
              orderUpdated.end_index_price <= orderUpdated.target_index_price
            ) {
              recieveETH = (
                parseFloat(orderUpdated.recieve) /
                  parseFloat(orderUpdated.end_index_price) +
                parseFloat(orderUpdated.amount)
              ).toFixed(ethDecimals);
            } else {
              recieveUSDC = (
                parseFloat(orderUpdated.price) *
                  parseFloat(orderUpdated.amount) +
                parseFloat(orderUpdated.recieve)
              ).toFixed(usdcDecimals);
            }
          }
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
      } else {
        await updateLog(logId, {
          status: `order ${order.order_id} in pending`,
        });
      }
    }
    return payoutData;
  } catch (e) {
    console.log(parseError(e));
    await updateLog(logId, {
      status: 'failed',
      error: parseError(e),
    });
  }
};

const resetOrders = async () => {
  if (dbEnv === 'development') {
    let orders = await db.models.Order.findAll({
      where: {
        [db.Op.and]: [
          { execute_date: { [db.Op.gt]: '2023-03-28' } },
          { execute_date: { [db.Op.lt]: '2023-04-01' } },
        ],
      },
    });
    for (const order of orders) {
      await db.models.Order.update(
        {
          execute_date: '2023-03-31',
          order_complete: false,
          status: 'created',
          end_index_price: null,
        },
        { where: { order_id: order.order_id } }
      );
    }
  }
};

module.exports = { listenForPayout, resetOrders };
