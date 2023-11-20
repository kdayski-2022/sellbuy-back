const db = require('../database');
const { getDaysDifference } = require('../lib/dates');
const { getApr } = require('../lib/utils');

db.connection.authenticate().then(async () => {
  try {
    const orders = await db.models.Order.findAll({});
    for (const order of orders) {
      const days = getDaysDifference(order.createdAt, order.settlement_date);
      const apr = getApr(order.recieve, order.price, order.amount, days);
      await db.models.Order.update({ apr }, { where: { id: order.id } });
    }
    console.log('done');
  } catch (e) {
    console.log(e);
  }
});
