const axios = require('axios');
const dotenv = require('dotenv');
const { DIRECTION } = require('../enum/enum');
const {
  strike_step_buy,
  strike_step_sell,
} = require('../config/constants.json');
dotenv.config();
const apiUrl = process.env.API_URL;

const getCurrentPrice = async (tokenSymbol) => {
  try {
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    tokenSymbol = tokenSymbol.toLowerCase();
    const { data } = await axios.get(
      `${apiUrl}/public/get_index_price?index_name=${tokenSymbol}_usdc`
    );
    const price = Number(data.result.index_price.toFixed(2));
    return price;
  } catch (e) {
    console.log(e);
    throw e;
  }
};

const getPrices = async (tokenSymbol, direction) => {
  try {
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    const currentPrice = await getCurrentPrice(tokenSymbol);
    const prices = [];
    const formattedCurrentPrice =
      Math.ceil(currentPrice / strike_step_buy[tokenSymbol]) *
      strike_step_buy[tokenSymbol];
    if (direction === DIRECTION.BUY) {
      for (let i = -4; i < 0; i++) {
        prices.push(formattedCurrentPrice + i * strike_step_buy[tokenSymbol]);
      }
      if (prices[0] % 1000 && tokenSymbol === 'BTC') {
        prices[0] = prices[0] - strike_step_buy[tokenSymbol];
      }
    }
    if (direction === DIRECTION.SELL) {
      for (let i = 0; i < 4; i++) {
        prices.push(formattedCurrentPrice + i * strike_step_sell[tokenSymbol]);
      }
      if (prices[3] % 1000 && tokenSymbol === 'BTC') {
        prices[3] = prices[3] + strike_step_buy[tokenSymbol];
      }
    }
    prices.sort((a, b) => b - a);
    return { currentPrice, prices };
  } catch (e) {
    console.log(e);
    throw e;
  }
};

module.exports = {
  getCurrentPrice,
  getPrices,
};
