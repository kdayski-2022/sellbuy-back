const Web3 = require('web3');
const axios = require('axios');
const db = require('../database');
const { writeLog, updateLog } = require('./logger');
const { buy_data, sell_data } = require('../config/requestData.json');
const { getAccessToken } = require('./auth');
const dotenv = require('dotenv');
const { parseError, smartRound } = require('./lib');
const { getSubject, sendMail, getDealInitiationBody } = require('./email');
const {
  getUntilExpirationDays,
  formatDate,
  getDaysDifference,
  getValidDays,
  getTimestamp,
} = require('./dates');
const { USER_COMMISSION } = require('../config/constants.json');
const { INFURA_PROVIDERS } = require('../config/infura');
const {
  DECIMALS,
  VALID_AMOUNT,
  VALID_STEP,
  VALID_DECIMALS,
} = require('../config/network');
const Eth = require('./etherscan');
const { getApr } = require('./utils');
const { checkFirstTx, createAmountEarned } = require('./user');
const { CHAT } = require('../enum/enum');
const { getCurrentPrice } = require('./price');
dotenv.config();
const apiUrl = process.env.API_URL;

const postOrder = async (data) => {
  const logId = await writeLog({
    action: 'system postOrder',
    status: 'in progress',
  });
  const {
    attempt_id,
    amount,
    price,
    period,
    instrument_name,
    estimated_delivery_price,
    bid_price,
    address,
    hash,
    direction,
    contract_text,
    chain_id,
    token_symbol,
    order_hedged,
  } = data;
  const postData = direction === 'sell' ? sell_data : buy_data;
  postData.params.instrument_name = instrument_name;
  postData.params.amount = Number(amount);
  const depositAmount =
    direction === 'sell' ? amount : Number(amount) * Number(price);
  let depositToken = direction === 'sell' ? token_symbol : 'USDC';
  depositToken = depositToken === 'WBTC' ? 'BTC' : depositToken;
  try {
    const start_index_price = await getCurrentPrice(token_symbol);
    const userOrders = await db.models.Order.findAll({
      where: { from: address.toLowerCase() },
    });
    let totalTradedValue =
      direction === 'sell' ? start_index_price * amount : price * amount;
    totalTradedValue += userOrders.reduce((total, order) => {
      const price =
        order.direction === 'sell' ? order.start_index_price : order.price;
      return total + order.amount * price;
    }, 0);
    telegram.send(
      `[CNT: ${userOrders.length + 1} | TTV: $${totalTradedValue.toFixed(
        0
      )}]\nUser ${address} deposited ${
        Math.round(depositAmount * 100) / 100
      } ${depositToken}`
    );
    const web3 = new Web3(INFURA_PROVIDERS[chain_id]);

    const user = await db.models.User.findOne({
      where: { address: address.toLowerCase() },
    });
    let commission = USER_COMMISSION;
    if (user) commission = user.commission;

    const transactionReceipt = await web3.eth.getTransactionReceipt(hash);
    const status = transactionReceipt && transactionReceipt.status;
    const recieve =
      estimated_delivery_price * bid_price * Number(amount) * commission;
    const days = getDaysDifference(period);
    const apr = getApr(recieve, price, amount, days);

    if (status) {
      await db.models.Order.create({
        attempt_id,
        from: address.toLowerCase(),
        user_payment_tx_hash: hash,
        amount,
        price,
        order_complete: false,
        payment_complete: status ? true : false,
        instrument_name,
        execute_date: period,
        recieve,
        status: 'pending',
        direction,
        contract_text,
        commission,
        chain_id,
        order_hedged,
        token_symbol,
        apr,
      });

      let data;
      if (amount >= VALID_AMOUNT[token_symbol]) {
        const accessToken = await getAccessToken();

        const validAmount = (
          Math.floor(amount / VALID_STEP[token_symbol]) *
          VALID_STEP[token_symbol]
        ).toFixed(VALID_DECIMALS[token_symbol]);
        postData.params.amount = validAmount;
        const res = await axios.post(apiUrl, postData, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        data = res.data;
      }

      const order_id =
        data && data.result && data.result.order && data.result.order.order_id
          ? data.result.order.order_id
          : null;
      const order =
        data && data.result && data.result.order
          ? JSON.stringify(data.result.order)
          : null;

      await db.models.Order.update(
        {
          status: 'created',
          order_id,
          order,
          target_index_price: price,
          start_index_price,
        },
        { where: { user_payment_tx_hash: hash } }
      );
      telegram.send(
        `Order was made by user ${address}\n${
          data?.result?.order?.instrument_name || instrument_name
        }`
      );
      try {
        const date = instrument_name.split('-')[1];
        const formattedDate = date.slice(0, date.length - 2);
        telegram.send(
          `THE LIMIT ${direction.toUpperCase()} ${amount} ${token_symbol} ${price} ${formattedDate} APR ${apr.toFixed(
            0
          )}%`,
          CHAT.CLUB
        );
      } catch (e) {
        console.log('While sending message to club error');
        console.log(e);
      }

      try {
        await createAmountEarned(address.toLowerCase(), recieve);
      } catch (e) {
        console.log(e);
        console.log('While adding user points history error');
        telegram.send('[NOT CRITICAL] While adding user points history error');
      }

      try {
        await checkFirstTx(address.toLowerCase());
      } catch (e) {
        console.log(e);
        console.log('While adding points for transaction error');
        telegram.send(
          '[NOT CRITICAL] While adding points for transaction error'
        );
      }

      try {
        const orderDB = await db.models.Order.findOne({
          where: {
            user_payment_tx_hash: hash,
          },
        });

        const subscription = await db.models.UserSubscription.findOne({
          where: {
            address: address.toLowerCase(),
            transaction_notifications: true,
          },
        });

        if (subscription) {
          const subject = getSubject('transaction_notifications');
          const html = getDealInitiationBody(subscription, {
            ...orderDB,
            bid_price,
            estimated_delivery_price,
          });
          await sendMail([subscription.email], subject, '', html);
        }
      } catch (e) {
        console.log(e);
        console.log('While sending email error');
        telegram.send('[NOT CRITICAL] While sending email error');
      }

      updateLog(logId, { status: 'success' });
      return { success: true, order_id, hash };
    } else {
      updateLog(logId, {
        status: 'failed',
        error: 'Transaction was not mined',
      });
      return { success: false, error: 'Transaction was not mined' };
    }
  } catch (e) {
    console.log(e);
    updateLog(logId, { status: 'failed', error: parseError(e) });
    telegram.send(
      `Order ${instrument_name} creation failed by user ${address}\n${JSON.stringify(
        e?.response?.data?.error
      )}`
    );
    return { success: false, error: e?.response?.data?.error?.message };
  }
};

const calculatePayouts = async (order) => {
  try {
    const {
      direction,
      end_index_price,
      target_index_price,
      price,
      amount,
      recieve,
      token_symbol,
    } = order;
    let order_executed;
    if (direction === 'sell') {
      order_executed = end_index_price >= target_index_price;
    }
    if (direction === 'buy') {
      order_executed = end_index_price <= target_index_price;
    }

    const USDCToPay = (
      parseFloat(price) * parseFloat(amount) +
      parseFloat(recieve)
    ).toFixed(DECIMALS['USDC']);
    const BaseToPay = (
      parseFloat(amount) +
      parseFloat(recieve) / parseFloat(end_index_price)
    ).toFixed(DECIMALS[token_symbol]);

    const payout_currency = await getPayoutCurrency({
      ...order,
      order_executed,
    });

    return { order_executed, payout_currency, USDCToPay, BaseToPay };
  } catch (e) {
    throw e;
  }
};

const getPayoutCurrency = async (order) => {
  const { order_executed, direction, token_symbol } = order;
  if (order_executed && direction === 'sell') return 'USDC';
  if (!order_executed && direction === 'sell') return token_symbol;
  if (order_executed && direction === 'buy') return token_symbol;
  if (!order_executed && direction === 'buy') return 'USDC';
};

const getPayin = async (web3, order) => {
  try {
    const data = await web3.eth.getTransaction(order.user_payment_tx_hash);
    if (!data) return false;
    let value = data.value;
    if (value) value = Number(web3.utils.fromWei(new web3.utils.BN(value)));
    if (data.input !== '0x') {
      const input = `0x${data.input.slice(10, 138)}`;
      const res = await web3.eth.abi.decodeParameters(
        ['address', 'uint256'],
        input
      );
      value = await Eth.tokenFromWei(res['1'], data.to, order.chain_id);
    }

    let amountCorrect = false;
    const addressCorrect = order.from.toLowerCase() === data.from.toLowerCase();
    if (order.direction === 'buy') {
      amountCorrect =
        Math.round(Number(order.amount) * Number(order.price) * 100) / 100 ===
        Number(value);
    }
    if (order.direction === 'sell') {
      amountCorrect = Number(order.amount) === Number(value);
    }

    return amountCorrect && addressCorrect;
  } catch (e) {
    console.log(e);
    return false;
  }
};

const prepareContractData = (order) => {
  let recieveETH = 0;
  if (parseFloat(order.recieve) && parseFloat(order.start_index_price)) {
    recieveETH = smartRound(
      parseFloat(order.amount) +
        smartRound(
          parseFloat(order.recieve) / parseFloat(order.start_index_price)
        ),
      3
    );
  }
  const lock = parseFloat(order.amount) * parseFloat(order.price);
  const floorRecieve = Math.floor(parseFloat(order.recieve));
  const recieveUSDC =
    Math.round(
      (parseFloat(order.amount) * parseFloat(order.price) + floorRecieve) * 100
    ) / 100;
  const USDC =
    Math.round(parseFloat(order.price) * parseFloat(order.amount) * 100) / 100;
  const untilExpirationDays = getUntilExpirationDays(order.execute_date);
  const expirationDate = formatDate(order.execute_date);
  return {
    lock,
    recieveUSDC,
    USDC,
    floorRecieve,
    untilExpirationDays,
    expirationDate,
    recieveETH,
  };
};

const getContractText = (order) => {
  const {
    lock,
    recieveUSDC,
    USDC,
    floorRecieve,
    untilExpirationDays,
    expirationDate,
    recieveETH,
  } = prepareContractData(order);
  let message;
  if (order.direction === 'buy') {
    message = `You are going to lock ${
      Math.round(lock * 100) / 100
    } USDC for ${untilExpirationDays} to receive either ${recieveUSDC} USDC (${USDC} + ${floorRecieve}) if on the ${expirationDate} 8:00 UTC ${
      order.token_symbol
    } price is above ${order.price}, or ${recieveETH} ${order.token_symbol} (${
      order.amount
    } + ${smartRound(
      parseFloat(order.recieve) / parseFloat(order.start_index_price)
    )}) if ${order.token_symbol} price is below ${
      order.price
    }. Funds will be returned to your wallet automatically before ${expirationDate} 9:00 UTC.`;
  }

  if (order.direction === 'sell') {
    message = `You are going to lock ${order.amount} ${
      order.token_symbol
    } for ${untilExpirationDays} to receive either ${recieveETH} ${
      order.token_symbol
    } (${order.amount} + ${smartRound(
      parseFloat(order.recieve) / parseFloat(order.start_index_price)
    )}) if on the ${expirationDate} 8:00 UTC ${
      order.token_symbol
    } price is below ${
      order.price
    }, or ${recieveUSDC} USDC (${USDC} + ${floorRecieve}) if ${
      order.token_symbol
    } price is above ${
      order.price
    }. Funds will be returned to your wallet automatically before ${expirationDate} 9:00 UTC.`;
  }
  return message;
};

const getContractHtml = (order) => {
  const {
    lock,
    recieveUSDC,
    USDC,
    floorRecieve,
    untilExpirationDays,
    expirationDate,
    recieveETH,
  } = prepareContractData(order);
  let message;
  token_symbol = order.token_symbol === 'BTC' ? 'WBTC' : order.token_symbol;
  if (order.direction === 'buy') {
    message = `You are going to lock ${
      Math.round(lock * 100) / 100
    } USDC for ${untilExpirationDays} to receive either ${recieveUSDC} USDC (${USDC} + ${floorRecieve}) if on the ${expirationDate} 8:00 UTC ${
      order.token_symbol
    } price is above ${order.price}, or ${recieveETH} ${token_symbol} (${
      order.amount
    } + ${smartRound(
      parseFloat(order.recieve) / parseFloat(order.start_index_price)
    )}) if ${order.token_symbol} price is below ${
      order.price
    }. Funds will be returned to your wallet automatically before ${expirationDate} 9:00 UTC.`;
  }

  if (order.direction === 'sell') {
    message = `You are going to lock ${
      order.amount
    } ${token_symbol} for ${untilExpirationDays} to receive either ${recieveETH} ${token_symbol} (${
      order.amount
    } + ${smartRound(
      parseFloat(order.recieve) / parseFloat(order.start_index_price)
    )}) if on the ${expirationDate} 8:00 UTC ${
      order.token_symbol
    } price is below ${
      order.price
    }, or ${recieveUSDC} USDC (${USDC} + ${floorRecieve}) if ${
      order.token_symbol
    } price is above ${
      order.price
    }. Funds will be returned to your wallet automatically before ${expirationDate} 9:00 UTC.`;
  }
  return message;
};

const getOrder = async (data) => {
  try {
    const { period, price, amount, direction, address } = data;
    let { tokenSymbol } = data;
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    const apiRes = await axios.get(
      `${apiUrl}/public/get_book_summary_by_currency?currency=${tokenSymbol}&kind=option`
    );

    const filteredTypes = apiRes.data.result.filter((item) => {
      const typesArray = item.instrument_name.split('-');
      const type = typesArray[typesArray.length - 1];
      return direction === 'sell' ? type === 'C' : type === 'P';
    });

    const filteredPrices = filteredTypes.filter((item) => {
      const priceArray = item.instrument_name.split('-');
      const instrument_price = priceArray[priceArray.length - 2];
      return instrument_price === price;
    });

    const fillteredDates = filteredPrices.filter((item) => {
      const [_, stortedDataUnderlying_index] = item.instrument_name.split('-');
      const targetPeriod = Date.parse(stortedDataUnderlying_index);
      const daysDifference = getDaysDifference(period);
      const validDays = getValidDays(daysDifference, targetPeriod);
      const choosenDay = new Date(Number(period)).getDate();
      const choosenMonth = new Date(Number(period)).getMonth();
      const targetMonth = new Date(getTimestamp(targetPeriod)).getMonth();
      if (validDays.includes(choosenDay) && choosenMonth === targetMonth)
        return item;
    });

    const bidPriceAvailable = fillteredDates.filter((item) => item.bid_price);

    if (!bidPriceAvailable.length) throw new Error("Order wasn't found");

    const maxBidPriceObj = bidPriceAvailable
      .sort((a, b) =>
        a.bid_price > b.bid_price ? 1 : b.bid_price > a.bid_price ? -1 : 0
      )
      .reverse()[0];
    const { estimated_delivery_price, bid_price } = maxBidPriceObj;
    let user = null;
    if (address) {
      user = await db.models.User.findOne({
        where: { address },
      });
    }
    let commission = USER_COMMISSION;
    if (user) commission = user.commission;
    const recieve =
      estimated_delivery_price * bid_price * Number(amount) * commission;
    const start_index_price = await getCurrentPrice(tokenSymbol);
    let order = {
      ...maxBidPriceObj,
      recieve,
      amount: Number(amount),
      price: Number(price),
      period: Number(period),
      execute_date: new Date(Number(period)),
      start_index_price,
      token_symbol: tokenSymbol,
      direction,
    };
    const contract_html = getContractHtml(order);
    const contract_text = getContractText(order);

    return {
      ...order,
      contract_html,
      contract_text,
    };
  } catch (e) {
    console.log(e);
    throw e;
  }
};

module.exports = {
  postOrder,
  getOrder,
  calculatePayouts,
  getPayin,
  getContractText,
  getContractHtml,
};
