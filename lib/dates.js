const { TOMORROW, WEEK, TWO_WEEK, MONTH } = require('../config/constants.json')

const getCurrentDay = () => {
  return new Date().getTime();
};

const getFirstDayOfWeek = (timestamp = Date.now()) => {
  const day = new Date(timestamp);
  const firstDayOfWeek = new Date(
    day.setDate(day.getDate() - day.getDay() + 1)
  ).getTime();
  return firstDayOfWeek;
};

const getLastDayOfWeek = (timestamp = Date.now()) => {
  const day = new Date(timestamp);
  const lastDayOfWeek = new Date(
    day.setDate(day.getDate() - day.getDay() + 7)
  ).getTime();
  return lastDayOfWeek;
};

const getFutureTimestamp = (chooseableDay) => {
  const day = new Date();
  switch (chooseableDay) {
    case TOMORROW:
      const nextDayofWeek = new Date(day.setDate(day.getDate() + 1)).getTime();
      console.log(nextDayofWeek);
      return nextDayofWeek;

    case WEEK:
      const week = new Date(day.setDate(day.getDate() + 7)).getTime();
      console.log(week);
      return week;

    case TWO_WEEK:
      const twoWeek = new Date(day.setDate(day.getDate() + 14)).getTime();
      console.log(twoWeek);
      return twoWeek;

    case MONTH:
      const month = new Date(day.setMonth(day.getMonth() + 1)).getTime();
      console.log(month);
      return month;

    default:
      return day.getTime();
  }
};

module.exports = { getCurrentDay, getLastDayOfWeek, getFirstDayOfWeek, getFutureTimestamp }

//ТЗ сформировать current day of week и last day of week внутри запроса/ов где они используются
