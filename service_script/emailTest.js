const db = require('../database');
const {
  getSubject,
  getDealExpirationBody,
  sendMail,
  getDealInitiationBody,
} = require('../lib/email');
db.connection.authenticate().then(async () => {
  // const id = 828;
  const id = 918;

  const orderDB = await db.models.Order.findOne({
    where: { id },
  });
  const orderAttempt = await db.models.OrderAttempt.findOne({
    where: { id: orderDB.attempt_id },
  });
  orderDB.bid_price = orderAttempt.bid_price;
  orderDB.estimated_delivery_price = orderAttempt.estimated_delivery_price;

  const userCompleteOrders = await db.models.Order.findAll({
    where: {
      from: orderDB.from.toLowerCase(),
      status: 'approved',
      order_complete: true,
    },
  });

  const totalEarned = userCompleteOrders
    .map(({ recieve }) => (recieve ? recieve : 0))
    .reduce((a, b) => a + b, 0);

  const subscription = await db.models.UserSubscription.findOne({
    where: {
      address: '0x1fdc1c823c156917f6166efc921a892d627c22a1',
      transaction_notifications: true,
    },
  });

  if (subscription) {
    orderDB.subscription = subscription;
    orderDB.total = {
      earned: totalEarned,
      orders: userCompleteOrders.length,
    };

    // orderDB.subscription.email = 'npoqpu2010@mail.ru';
    // orderDB.subscription.email = 'igorlebedev018@gmail.com';
    // orderDB.subscription.email = 'npoqpu6@gmail.com';
    orderDB.subscription.email = 'georgv@me.com';

    const emails = [orderDB.subscription.email];

    const subject = getSubject('transaction_notifications');
    // const html = getDealExpirationBody(orderDB);
    const html = getDealInitiationBody(orderDB);
    await sendMail(emails, subject, '', html);
  }
  console.log('ok');
});
