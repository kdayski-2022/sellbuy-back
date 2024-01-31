const db = require('../database');

db.connection.authenticate().then(async () => {
  try {
    let orders = await db.models.Order.findAll({
      where: { id: { [db.Op.gt]: 1080 } },
    });
    for (const order of orders) {
      await db.models.Order.update(
        {
          execute_date: '2024-01-30',
          order_complete: false,
          status: 'created',
          end_index_price: null,
          settlement_date: null,
          payout_base: null,
          payout_usdc: null,
          payout_tx: null,
          order_executed: null,
          payout_currency: null,
        },
        { where: { order_id: order.order_id } }
      );
    }
    console.log('done');
  } catch (e) {
    console.log(e);
  }
});
