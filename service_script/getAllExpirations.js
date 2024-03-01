const fs = require('fs');
const { TOKEN_ADDRESS, INFURA_PROVIDERS } = require('../config/network');
const db = require('../database');
const Web3 = require('web3');

const convertFloatToBnString = (float, decimals) => {
  let result;
  let [left, right] = String(float).split('.');
  if (right && right.length > decimals) right = right.slice(0, decimals);
  result = left;
  if (right) {
    right = right.padEnd(decimals, '0');
    result = left.concat(right);
  } else {
    result = result + '0'.repeat(decimals);
  }
  return result.toString().replace(/^0+/, '');
};

const roundToNearestHour = (date) => {
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date.getTime();
};

db.connection.authenticate().then(async () => {
  try {
    let orders = await db.models.Order.findAll({
      where: { status: 'approved' },
    });
    orders = orders.map(({ settlement_date, ...order }) => ({
      ...order,
      settlement_date: roundToNearestHour(new Date(settlement_date)),
    }));

    const uniqueExecuteDates = [
      ...new Set(orders.map((item) => item.settlement_date)),
    ].sort((a, b) => a - b);

    const expirations = [];

    for (const settlement_date of uniqueExecuteDates) {
      let expiration = orders.filter(
        (order) => order.settlement_date === settlement_date
      );

      const WBTC = expiration.find((item) => item.token_symbol === 'WBTC');
      const WETH = expiration.find(
        (item) =>
          item.token_symbol === 'ETH' ||
          item.token_symbol === undefined ||
          item.token_symbol === null
      );
      const prices = {
        WBTC: WBTC ? WBTC.end_index_price : 0,
        WETH: WETH.end_index_price,
      };
      console.log(prices);
      expiration = expiration.map((order) => {
        const tokenIn =
          order.direction === 'sell'
            ? TOKEN_ADDRESS[order.chain_id][order.token_symbol]
            : TOKEN_ADDRESS[order.chain_id]['USDC'];
        const amountIn =
          order.direction === 'sell'
            ? order.amount
            : parseFloat((order.amount * order.price).toFixed(6));
        const tokenOut = TOKEN_ADDRESS[order.chain_id][order.payout_currency];
        let targetTokenSymbolOut = 'USDC';
        if (order.direction === 'buy') {
          targetTokenSymbolOut = order.token_symbol || 'ETH';
        }
        let amountOut;
        if (order.order_executed) {
          if (tokenIn === TOKEN_ADDRESS[order.chain_id]['USDC'])
            amountOut = order.amount;
          if (tokenIn === TOKEN_ADDRESS[order.chain_id][order.token_symbol])
            amountOut = order.amount * order.price;
        } else {
          if (tokenIn === TOKEN_ADDRESS[order.chain_id]['USDC'])
            amountOut = order.amount * order.price;
          if (tokenIn === TOKEN_ADDRESS[order.chain_id][order.token_symbol])
            amountOut = order.amount;
        }

        let recieve = convertFloatToBnString(order.recieve, 6);
        const provider = new Web3.providers.HttpProvider(
          INFURA_PROVIDERS[order.chain_id]
        );
        const web3 = new Web3(provider);
        const BN = web3.utils.BN;
        let additionalAmount;
        const decimals = 6;
        const delimiter = new BN('10')
          .pow(new BN(String(18 - Number(decimals))))
          .toString();
        const value = new BN(recieve).mul(new BN(delimiter)).toString();
        additionalAmount = web3.utils.fromWei(value, 'ether');

        return {
          user: order.from.toLowerCase(),
          tokenIn,
          amountIn,
          tokenOut,
          amountOut,
          price: order.price,
          additionalAmount,
          endTimestamp: new Date(order.settlement_date),
          targetTokenSymbolOut,
          direction: order.direction,
          order_executed: order.order_executed,
        };
      });

      expirations.push({
        prices,
        expirationDate: settlement_date,
        orders: expiration,
      });
    }

    fs.writeFileSync('expirations.json', JSON.stringify(expirations));
  } catch (e) {
    console.log(e);
  }
});
