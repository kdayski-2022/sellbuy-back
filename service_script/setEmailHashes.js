const db = require('../database');
const crypto = require('crypto');
const md5 = require('md5');
const md5Salt = process.env.md5Salt;
db.connection.authenticate().then(async () => {
  try {
    const subscriptions = await db.models.UserSubscription.findAll({
      where: { email: { [db.Op.ne]: '' } },
    });

    for (const subscription of subscriptions) {
      const address_hash = md5(md5Salt + subscription.address);
      await db.models.UserSubscription.update(
        { address_hash },
        { where: { id: subscription.id } }
      );
    }
    console.log('ok');
  } catch (e) {
    console.log(e);
  }
});
