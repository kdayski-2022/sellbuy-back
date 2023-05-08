const {
  getFutureTimestamp,
  getDaysDifference,
  getValidDays,
  getTimestamp,
} = require('../lib/dates');
const db = require('../database');
const axios = require('axios');
const dotenv = require('dotenv');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const Web3 = require('web3');
const ERC20Abi = require('../abi/ERC20.json');
const Transfer = require('../lib/transfer');
const { USER_COMMISSION } = require('../config/constants.json');
const { getApr } = require('../lib/utils');
dotenv.config();
const apiUrl = process.env.API_URL;
const infuraRpc = process.env.INFURA_RPC;
const WITHDRAWAL_TOKEN_ADDRESS = process.env.WITHDRAWAL_TOKEN_ADDRESS;

class PeriodController {
  async getPeriods(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getPeriods',
      status: 'in progress',
      sessionInfo,
      req,
    });
    try {
      const periods = [
        {
          title: `${getDaysDifference(getFutureTimestamp(1))} days`,
          timestamp: getFutureTimestamp(1),
        },
        {
          title: `${getDaysDifference(getFutureTimestamp(2))} days`,
          timestamp: getFutureTimestamp(2),
        },
        {
          title: `${getDaysDifference(getFutureTimestamp(3))} days`,
          timestamp: getFutureTimestamp(3),
        },
        {
          title: `${getDaysDifference(getFutureTimestamp(4))} days`,
          timestamp: getFutureTimestamp(4),
        },
      ];
      updateLog(logId, { status: 'success' });
      res.json({ success: true, data: { periods }, sessionInfo });
    } catch (e) {
      updateLog(logId, { status: 'failed', error: parseError(e) });
      res.json({ success: false, data: null, sessionInfo });
    }
  }

  async getPricePeriods(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getPricePeriods',
      status: 'in progress',
      sessionInfo,
      req,
    });
    axios
      .get(
        `${apiUrl}/public/get_book_summary_by_currency?currency=ETH&kind=option`
      )
      .then(async (apiRes) => {
        try {
          const { price, amount } = req.query;
          const direction = req.headers['direction-type'];
          const periods = [
            {
              title: `${getDaysDifference(getFutureTimestamp(1))} days`,
              timestamp: getFutureTimestamp(1),
            },
            {
              title: `${getDaysDifference(getFutureTimestamp(2))} days`,
              timestamp: getFutureTimestamp(2),
            },
            {
              title: `${getDaysDifference(getFutureTimestamp(3))} days`,
              timestamp: getFutureTimestamp(3),
            },
            {
              title: `${getDaysDifference(getFutureTimestamp(4))} days`,
              timestamp: getFutureTimestamp(4),
            },
          ];
          const result = [];

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

          await Promise.all(
            periods.map(async ({ title, timestamp }) => {
              if (title === '1 days') return;
              const filteredDates = filteredPrices.filter((item) => {
                const [_, sortedDataUnderlying_index] =
                  item.underlying_index.split('-');

                const targetPeriod = Date.parse(sortedDataUnderlying_index);
                const daysDifference = getDaysDifference(timestamp);
                const validDays = getValidDays(daysDifference, targetPeriod);
                const chosenDay = new Date(Number(timestamp)).getDate();
                const chosenMonth = new Date(Number(timestamp)).getMonth();
                const targetMonth = new Date(
                  getTimestamp(targetPeriod)
                ).getMonth();
                if (
                  validDays.includes(chosenDay) &&
                  chosenMonth === targetMonth
                ) {
                  return item;
                }
              });

              // ! ONLY FOR DEV
              // const bidPriceAvailable = filteredDates.map(
              // 	(item) => item.bid_price ? item : {...item, bid_price: Math.random() / 10}
              //   );

              const bidPriceAvailable = filteredDates.filter(
                (item) => item.bid_price
              );

              if (!bidPriceAvailable.length)
                return result.push({
                  title,
                  timestamp,
                  recieve: null,
                  percent: null,
                  error: "Order wasn't found",
                });

              const maxBidPriceObj = bidPriceAvailable
                .sort((a, b) =>
                  a.bid_price > b.bid_price
                    ? 1
                    : b.bid_price > a.bid_price
                    ? -1
                    : 0
                )
                .reverse()[0];
              const { estimated_delivery_price, bid_price, underlying_index } =
                maxBidPriceObj;
              const user = await db.models.User.findOne({
                where: { address: sessionInfo.userAddress.toLowerCase() },
              });
              let commission = USER_COMMISSION;
              if (user) commission = user.commission;
              const recieve =
                estimated_delivery_price * bid_price * amount * commission;
              const percent = (recieve / price) * 100;
              const days = getDaysDifference(timestamp);
              const apr = getApr(
                estimated_delivery_price,
                bid_price,
                price,
                commission,
                days
              );
              const earnPercent =
                Math.round((recieve / (amount * price)) * 100 * 100) / 100;
              if (!Math.floor(recieve))
                return result.push({
                  title,
                  timestamp,
                  recieve: null,
                  percent: null,
                  error: "Order wasn't found",
                });

              const futureTimestamp = new Date(
                Date.parse(underlying_index.split('-')[1])
              ).getTime();
              result.push({
                title: `${getDaysDifference(futureTimestamp)} days`,
                timestamp: futureTimestamp,
                days: getDaysDifference(futureTimestamp),
                // title,
                // timestamp,
                // days,
                recieve,
                percent,
                apr,
                price,
                amount,
                earnPercent,
                error: null,
              });
            })
          );

          updateLog(logId, { status: 'success' });
          res.json({ success: true, data: { periods: result }, sessionInfo });
        } catch (e) {
          console.log(e);
          updateLog(logId, { status: 'failed', error: parseError(e) });
          res.json({
            success: false,
            data: { periods: [] },
            error: e.message,
            sessionInfo,
          });
        }
      });
  }
}

module.exports = new PeriodController();
