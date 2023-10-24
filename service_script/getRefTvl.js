const db = require('../database');

const ref_user_id = 182;

db.connection.authenticate().then(async () => {
  try {
    const refs = await db.models.User.findAll({ where: { ref_user_id } });
    let total = 0;
    for (const ref of refs) {
      const orders = await db.models.Order.findAll({
        where: { from: ref.address, status: 'created' },
      });
      let tvl = 0;
      for (const order of orders) {
        if (order.direction === 'sell')
          tvl += order.amount * order.start_index_price;
        if (order.direction === 'buy') tvl += order.amount * order.price;
      }
      ref.tvl = tvl;
      total += tvl;
    }
    console.log('success', refs);
    console.log({ total });
  } catch (e) {
    console.log(e);
  }
});
