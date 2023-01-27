const isEmpty = require('is-empty');
const { COMMISSION } = require('../config/constants.json');

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const formatToChartData = (orders) => {
  try {
    const data = {};
    orders.forEach(({ execute_date, recieve }) => {
      const ex = new Date(execute_date);
      data[ex.getFullYear()] = data[ex.getFullYear()]
        ? [...data[ex.getFullYear()], { month: ex.getMonth(), recieve }]
        : [{ month: ex.getMonth(), recieve }];
    });

    let sumByMonth = {};

    for (let year in data) {
      sumByMonth[year] = data[year].reduce((result, item) => {
        if (!result[item.month]) {
          result[item.month] = 0;
        }
        result[item.month] += item.recieve;
        return result;
      }, {});
    }

    let recieve = [];
    if (!isEmpty(sumByMonth)) {
      Object.keys(sumByMonth).forEach((year) => {
        if (isEmpty(sumByMonth[year])) return [];
        return Object.keys(sumByMonth[year]).forEach((month) =>
          recieve.push({
            year: Number(year),
            month: Number(month),
            count: sumByMonth[year][month],
            monthLong: monthNames[month],
          })
        );
      });
    }

    const income = getIncome(recieve);

    return { income, recieve };
  } catch (e) {
    throw new Error(e);
  }
};

const getIncome = (recieve) => {
  try {
    if (isEmpty(recieve)) return [];
    return recieve.map((item) => ({
      ...item,
      count: (item.count / (1 - COMMISSION)) * COMMISSION,
    }));
  } catch (e) {
    throw new Error(e);
  }
};

module.exports = { formatToChartData };
