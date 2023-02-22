const axios = require('axios');
const Web3 = require('web3');
const db = require('../database');
const { smartRound, parseError } = require('./lib');
const { writeLog, updateLog } = require('./logger');
const { approve } = require('./order');
const { get_index_price } = require('../config/requestData.json');
const Transfer = require('./transfer');
const transfer = new Transfer();
transfer.init();
const apiUrl = process.env.API_URL;
const infuraRpc = process.env.INFURA_RPC;
const dbEnv = process.env.DB_ENV;
const web3 = new Web3(infuraRpc);

const listenForPayout = async (order) => {
  const logId = await writeLog({
    action: 'system auto order complete',
    status: 'in progress',
  });
  try {
    const orderDetails = JSON.parse(order.order)
      ? JSON.parse(order.order)
      : null;
    if (orderDetails && order.order_id && order.status !== 'pending_approve') {
      const indexPriceData = await axios.post(apiUrl, get_index_price);
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

      // if (orderUpdated.autopay) {
      //   const { order_id, from } = orderUpdated;
      //   const { status, message } = await approve(order_id);
      //   console.log({ status, message });
      //   if (status === 'success') {
      //     telegram.send(
      //       `Autopayment successfully completed\n${message}\nto: ${from}\norder id: ${order_id}`
      //     );
      //     await updateLog(logId, { status });
      //   } else {
      //     telegram.send(`Autopayment completed with error\n${message}`);
      //     console.log(message);
      //     await updateLog(logId, {
      //       status,
      //       error: JSON.stringify(message),
      //     });
      //   }
      // }

      if (!orderUpdated.autopay) {
        let recieve;
        if (order.direction === 'sell') {
          if (orderUpdated.end_index_price >= orderUpdated.target_index_price) {
            recieve = `${
              parseFloat(orderUpdated.price) * parseFloat(orderUpdated.amount) +
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
            recieve = `${Number(web3.utils.fromWei(new BN(valueWei)))} ETH`;
          }
        } else {
          if (orderUpdated.end_index_price <= orderUpdated.target_index_price) {
            recieve = `${
              smartRound(
                parseFloat(orderUpdated.recieve) /
                  parseFloat(orderUpdated.end_index_price)
              ) + orderUpdated.amount
            } ETH`;
          } else {
            recieve = `${
              parseFloat(orderUpdated.price) * parseFloat(orderUpdated.amount) +
              parseFloat(orderUpdated.recieve)
            } USDC`;
          }
        }
        telegram.sendApprove(
          `Confirm the payment which you're about to make.\n${
            orderUpdated.from
          } will recieve ${recieve}\n\n${JSON.stringify(orderUpdated)}`,
          orderUpdated
        );
        return;
      }
    } else {
      await updateLog(logId, {
        status: `order ${order.order_id} in pending`,
      });
    }
  } catch (e) {
    console.log(parseError(e));
    await updateLog(logId, {
      status: 'failed',
      error: parseError(e),
    });
  }
};

const createPayoutData = async (orders) => {
  const logId = await writeLog({
    action: 'system auto order complete',
    status: 'in progress',
  });
  try {
    const payoutData = [[], [], [], []];
    for (const order of orders) {
      const orderDetails = JSON.parse(order.order)
        ? JSON.parse(order.order)
        : null;
      if (
        orderDetails &&
        order.order_id &&
        order.status !== 'pending_approve'
      ) {
        const indexPriceData = await axios.post(apiUrl, get_index_price);
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

        if (orderUpdated.smart_contract) {
          let recieveUSDC, recieveETH;
          if (order.direction === 'sell') {
            if (
              orderUpdated.end_index_price >= orderUpdated.target_index_price
            ) {
              recieveUSDC =
                parseFloat(orderUpdated.price) *
                  parseFloat(orderUpdated.amount) +
                parseFloat(orderUpdated.recieve);
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
              recieveETH = Number(web3.utils.fromWei(new BN(valueWei)));
            }
          } else {
            if (
              orderUpdated.end_index_price <= orderUpdated.target_index_price
            ) {
              recieveETH =
                smartRound(
                  parseFloat(orderUpdated.recieve) /
                    parseFloat(orderUpdated.end_index_price)
                ) + orderUpdated.amount;
            } else {
              recieveUSDC =
                parseFloat(orderUpdated.price) *
                  parseFloat(orderUpdated.amount) +
                parseFloat(orderUpdated.recieve);
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
    let orders = await db.models.Order.findAll();
    for (const order of orders) {
      await db.models.Order.update(
        {
          status: 'created',
          autopay: false,
          smart_contract: true,
          order_complete: false,
        },
        { where: { order_id: order.order_id } }
      );
    }
  }
};

module.exports = { listenForPayout, createPayoutData, resetOrders };
