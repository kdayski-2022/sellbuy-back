const axios = require('axios');
const dotenv = require('dotenv');
const { DIRECTION } = require('../enum/enum');
const { getDaysDifference } = require('../lib/dates');
const db = require('../database');
const { USER_COMMISSION } = require('../config/constants.json');
const { getApr } = require('../lib/utils');
const { getUserInfo } = require('./user');
dotenv.config();
const apiUrl = process.env.API_URL;

const getPricePeriods = async (data) => {
  try {
    const { direction, price, amount, address } = data;
    let { tokenSymbol } = data;
    tokenSymbol = tokenSymbol === 'WBTC' ? 'BTC' : tokenSymbol;
    const apiRes = await axios.get(
      `${apiUrl}/public/get_book_summary_by_currency?currency=${tokenSymbol}&kind=option`
    );
    const periods = [];
    const result = [];

    const filteredType = apiRes.data.result.filter((item) => {
      if (item.instrument_name.split('-').length === 4) {
        const [_, __, ___, itemType] = item.instrument_name.split('-');
        return direction === DIRECTION.SELL
          ? itemType === 'C'
          : itemType === 'P';
      } else return false;
    });

    const filteredPrice = filteredType.filter((item) => {
      if (item.instrument_name.split('-').length === 4) {
        const [_, __, itemPrice] = item.instrument_name.split('-');
        return itemPrice === price;
      } else return false;
    });

    const filteredWeekDay = filteredPrice.filter((item) => {
      const [_, sortedDataUnderlying_index] = item.instrument_name.split('-');
      const targetPeriod = Date.parse(sortedDataUnderlying_index);
      if (getDaysDifference(targetPeriod) === 0 && new Date().getDay() === 5)
        return false;

      return new Date(targetPeriod).getDay() === 5;
    });

    let filteredBidPrice = filteredWeekDay.filter((item) => item.bid_price);

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

    let filteredBidPriceValue = Array.from(instrumentNameToItemMap.values());

    filteredBidPriceValue.sort((a, b) => {
      const [_1, sortedDataUnderlying_index1] = a.instrument_name.split('-');
      const [_2, sortedDataUnderlying_index2] = b.instrument_name.split('-');
      const dateA = Date.parse(sortedDataUnderlying_index1);
      const dateB = Date.parse(sortedDataUnderlying_index2);
      return dateA - dateB;
    });

    if (filteredBidPriceValue.length > 4) {
      filteredBidPriceValue = filteredBidPriceValue.slice(0, 4);
    }

    filteredBidPriceValue.forEach(
      ({ estimated_delivery_price, bid_price, instrument_name }) => {
        const [_, sortedDataUnderlying_index] = instrument_name.split('-');
        let targetPeriod = Date.parse(sortedDataUnderlying_index);
        targetPeriod = new Date(targetPeriod);
        targetPeriod.setHours(targetPeriod.getHours() + 11);
        periods.push({
          title: `${getDaysDifference(targetPeriod)} days`,
          timestamp: targetPeriod,
          estimated_delivery_price,
          bid_price,
          instrument_name,
        });
      }
    );

    const { parent, user, ordersCount, commission } = await getUserInfo(
      address
    );

    const aprBonus = commission > USER_COMMISSION;
    const welcomeBonus = parent && user && !ordersCount;
    let welcomeBonusPercent = 0;

    await Promise.all(
      periods.map(
        async ({
          title,
          timestamp,
          estimated_delivery_price,
          bid_price,
          instrument_name,
        }) => {
          const reward = estimated_delivery_price * bid_price * Number(amount);
          const app_revenue = reward * (1 - commission);
          let recieve = reward * commission;
          if (welcomeBonus) {
            const parent_reward = (app_revenue / 100) * parent.ref_fee;
            recieve += parent_reward;
            welcomeBonusPercent = Number(
              ((parent_reward / recieve) * 100).toFixed(0)
            );
          }
          const percent = (recieve / price) * 100;
          const days = getDaysDifference(timestamp);
          const apr = getApr(recieve, price, amount, days);
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
    return { periods: result, aprBonus, welcomeBonus, welcomeBonusPercent };
  } catch (e) {
    console.log(e);
    throw e;
  }
};

module.exports = {
  getPricePeriods,
};
