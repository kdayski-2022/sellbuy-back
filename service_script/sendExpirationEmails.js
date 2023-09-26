const db = require('../database');
const { getSubject, getDealExpirationBody, sendMail } = require('../lib/email');

const expiration_range = ['2023-09-21', '2023-09-23'];
const subject_title = 'transaction_notifications';

db.connection.authenticate().then(async () => {
  try {
    const expiration = await db.models.Order.findAll({
      where: {
        [db.Op.and]: [
          { execute_date: { [db.Op.gt]: expiration_range[0] } },
          { execute_date: { [db.Op.lt]: expiration_range[1] } },
        ],
      },
    });
    for (const item of expiration) {
      try {
        const userCompleteOrders = await db.models.Order.findAll({
          where: {
            from: item.from.toLowerCase(),
            status: 'approved',
            order_complete: true,
          },
        });

        const totalEarned = userCompleteOrders
          .map(({ recieve }) => (recieve ? recieve : 0))
          .reduce((a, b) => a + b, 0);

        const subscription = await db.models.UserSubscription.findOne({
          where: {
            address: item.from.toLowerCase(),
            transaction_notifications: true,
          },
        });

        if (subscription) {
          item.subscription = subscription;
          item.total = {
            earned: totalEarned,
            orders: userCompleteOrders.length,
          };
          const subject = getSubject(subject_title);
          const html = getDealExpirationBody(item);
          await sendMail([item.subscription.email], subject, '', html);
          console.log([item.subscription.email]);
        }
      } catch (e) {
        console.log(e);
      }
    }
    console.log('success');
  } catch (e) {
    console.log(e);
  }
});
