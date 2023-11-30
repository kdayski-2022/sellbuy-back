const { DECIMALS } = require('../config/network');
const db = require('../database');
const { getDaysDifference } = require('../lib/dates');
const { calculatePayouts } = require('../lib/order');
const { getApr } = require('../lib/utils');

db.connection.authenticate().then(async () => {
  try {
    // const orders = await db.models.Order.findAll({});
    // for (const order of orders) {
    //   const days = getDaysDifference(order.createdAt, order.settlement_date);
    //   const apr = getApr(order.recieve, order.price, order.amount, days);
    //   await db.models.Order.update({ apr }, { where: { id: order.id } });
    // }

    const orders = await db.models.Order.findAll({
      where: { payout_base: NaN },
    });
    for (const order of orders) {
      const { USDCToPay, BaseToPay } = await calculatePayouts(order);
      const days = getDaysDifference(order.createdAt, order.execute_date);
      const apr = getApr(order.recieve, order.price, order.amount, days);
      console.log({ payout_base: BaseToPay, payout_usdc: USDCToPay, apr });
      await db.models.Order.update(
        { payout_base: BaseToPay, payout_usdc: USDCToPay, apr },
        { where: { id: order.id } }
      );
    }

    console.log('done');
  } catch (e) {
    console.log(e);
  }
});
