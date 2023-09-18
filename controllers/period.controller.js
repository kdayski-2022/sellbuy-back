const { getDaysDifference } = require('../lib/dates');
const db = require('../database');
const axios = require('axios');
const dotenv = require('dotenv');
const { writeLog, updateLog } = require('../lib/logger');
const { checkSession } = require('../lib/session');
const { parseError } = require('../lib/lib');
const { USER_COMMISSION } = require('../config/constants.json');
const { getApr } = require('../lib/utils');
dotenv.config();
const apiUrl = process.env.API_URL;

class PeriodController {
  async getPricePeriods(req, res) {
    const sessionInfo = await checkSession(req);
    const logId = await writeLog({
      action: 'getPricePeriods',
      status: 'in progress',
      sessionInfo,
      req,
    });
    const { price, amount } = req.query;
    let { tokenSymbol } = req.query;
    // TODO no such token in derebit
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    axios
      .get(
        `${apiUrl}/public/get_book_summary_by_currency?currency=${tokenSymbol}&kind=option`
      )
      .then(async (apiRes) => {
        try {
          const direction = req.headers['direction-type'];
          const periods = [];
          const result = [];

          const filteredType = apiRes.data.result.filter((item) => {
            if (item.instrument_name.split('-').length === 4) {
              const [_, __, ___, itemType] = item.instrument_name.split('-');
              return direction === 'sell' ? itemType === 'C' : itemType === 'P';
            } else return false;
          });

          const filteredPrice = filteredType.filter((item) => {
            if (item.instrument_name.split('-').length === 4) {
              const [_, __, itemPrice] = item.instrument_name.split('-');
              return itemPrice === price;
            } else return false;
          });

          const filteredWeekDay = filteredPrice.filter((item) => {
            const [_, sortedDataUnderlying_index] =
              item.instrument_name.split('-');
            const targetPeriod = Date.parse(sortedDataUnderlying_index);
            if (
              getDaysDifference(targetPeriod) === 0 &&
              new Date().getDay() === 5
            )
              return false;

            return new Date(targetPeriod).getDay() === 5;
          });

          let filteredBidPrice = filteredWeekDay.filter(
            (item) => item.bid_price
          );

          const instrumentNameToItemMap = new Map();
          filteredBidPrice.forEach((item) => {
            const [_, itemPrice] = item.instrument_name.split('-');
            const instrumentName = `${item.instrument_name}-${itemPrice}`;

            if (!instrumentNameToItemMap.has(instrumentName)) {
              instrumentNameToItemMap.set(instrumentName, item);
            } else {
              const existingItem = instrumentNameToItemMap.get(instrumentName);
              if (existingItem.bid_price < item.bid_price) {
                instrumentNameToItemMap.set(instrumentName, item);
              }
            }
          });

          let filteredBidPriceValue = Array.from(
            instrumentNameToItemMap.values()
          );

          filteredBidPriceValue.sort((a, b) => {
            const [_1, sortedDataUnderlying_index1] =
              a.instrument_name.split('-');
            const [_2, sortedDataUnderlying_index2] =
              b.instrument_name.split('-');
            const dateA = Date.parse(sortedDataUnderlying_index1);
            const dateB = Date.parse(sortedDataUnderlying_index2);
            return dateA - dateB;
          });

          if (filteredBidPriceValue.length > 4) {
            filteredBidPriceValue = filteredBidPriceValue.slice(0, 4);
          }

          filteredBidPriceValue.forEach(
            ({ estimated_delivery_price, bid_price, instrument_name }) => {
              const [_, sortedDataUnderlying_index] =
                instrument_name.split('-');
              const targetPeriod = Date.parse(sortedDataUnderlying_index);

              periods.push({
                title: `${getDaysDifference(targetPeriod)} days`,
                timestamp: targetPeriod,
                estimated_delivery_price,
                bid_price,
                instrument_name,
              });
            }
          );

          await Promise.all(
            periods.map(
              async ({
                title,
                timestamp,
                estimated_delivery_price,
                bid_price,
                instrument_name,
              }) => {
                let user = null;
                let commission = USER_COMMISSION;

                if (sessionInfo.userAddress) {
                  user = await db.models.User.findOne({
                    where: { address: sessionInfo.userAddress.toLowerCase() },
                  });
                }
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
                  Date.parse(instrument_name.split('-')[1])
                ).setHours(11, 0, 10, 0);

                result.push({
                  title: `${getDaysDifference(futureTimestamp)} days`,
                  timestamp: futureTimestamp,
                  days: getDaysDifference(futureTimestamp),
                  recieve,
                  percent,
                  apr,
                  price,
                  amount,
                  earnPercent,
                  error: null,
                });
              }
            )
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
