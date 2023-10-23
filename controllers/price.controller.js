const axios = require('axios');
const dotenv = require('dotenv');
const {
  strike_step_sell,
  strike_step_buy,
} = require('../config/constants.json');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
dotenv.config();
const apiUrl = process.env.API_URL;

class PriceController {
  async getCurrentPrice(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getCurrentPrice',
      status: 'in progress',
      sessionInfo,
      req,
    });
    let { tokenSymbol } = req.query;
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    axios
      .get(
        `${apiUrl}/public/get_book_summary_by_currency?currency=${tokenSymbol}&kind=option`
      )
      .then((apiRes) => {
        const currentPrice = apiRes.data.result[0].estimated_delivery_price;
        updateLog(logId, { status: 'success' });
        res.json({ success: true, data: { currentPrice }, sessionInfo });
      })
      .catch(async (err) => {
        updateLog(logId, { status: 'failed', error: JSON.stringify(err) });
        res.json({ success: false, data: null, sessionInfo });
      });
  }

  async getSellPrices(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getSellPrices',
      status: 'in progress',
      sessionInfo,
      req,
    });
    let { tokenSymbol } = req.query;
    // TODO no such token in derebit
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    axios
      .get(
        `${apiUrl}/public/get_book_summary_by_currency?currency=${tokenSymbol}&kind=option`
      )
      .then((apiRes) => {
        try {
          const currentPrice = apiRes.data.result[0].estimated_delivery_price;
          const prices = [];
          const formatedCurrentPrice =
            Math.ceil(currentPrice / strike_step_sell[tokenSymbol]) *
            strike_step_sell[tokenSymbol];
          for (let i = 0; i < 4; i++)
            prices.push(
              formatedCurrentPrice + i * strike_step_sell[tokenSymbol]
            );
          prices.sort((a, b) => b - a);
          updateLog(logId, { status: 'success' });
          res.json({
            success: true,
            data: { currentPrice, prices },
            sessionInfo,
          });
        } catch (e) {
          throw new Error(e.message);
        }
      })
      .catch((err) => {
        updateLog(logId, { status: 'failed', error: JSON.stringify(err) });
        res.json({ success: false, data: null, error: err, sessionInfo });
      });
  }

  async getBuyPrices(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getBuyPrices',
      status: 'in progress',
      sessionInfo,
      req,
    });
    let { tokenSymbol } = req.query;
    // TODO no such token in derebit
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    axios
      .get(
        `${apiUrl}/public/get_book_summary_by_currency?currency=${tokenSymbol}&kind=option`
      )
      .then((apiRes) => {
        try {
          const currentPrice = apiRes.data.result[0].estimated_delivery_price;
          const prices = [];
          const formatedCurrentPrice =
            Math.ceil(currentPrice / strike_step_buy[tokenSymbol]) *
            strike_step_buy[tokenSymbol];
          for (let i = -4; i < 0; i++)
            prices.push(
              formatedCurrentPrice + i * strike_step_buy[tokenSymbol]
            );
          prices.sort((a, b) => b - a);
          updateLog(logId, { status: 'success' });
          res.json({
            success: true,
            data: { currentPrice, prices },
            sessionInfo,
          });
        } catch (e) {
          throw new Error(e.message);
        }
      })
      .catch((err) => {
        updateLog(logId, { status: 'failed', error: JSON.stringify(err) });
        res.json({ success: false, data: null, error: err, sessionInfo });
      });
  }
}

module.exports = new PriceController();
