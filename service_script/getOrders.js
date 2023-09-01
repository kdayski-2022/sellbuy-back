const db = require('../database');
db.connection.authenticate().then(async () => {
  const orders = await db.models.Order.findAll({
    where: { from: '0xcccd0e2d04ddd767920e7817a24f6627eee15802' },
  });
  console.log(orders);
});
