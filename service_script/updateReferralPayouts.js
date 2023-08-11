const db = require('../database');

db.connection.authenticate().then(async () => {
  try {
    const userOwners = await db.models.User.findAll();

    for (const userOwner of userOwners) {
      const kids = await db.models.User.findAll({
        where: { ref_user_id: userOwner.id },
      });

      for (const kid of kids) {
        const ordersMadeBeingKid = await db.models.Order.findAll({
          where: {
            from: kid.address.toLowerCase(),
          },
        });
        for (const order of ordersMadeBeingKid) {
          const catched = await db.models.ReferralPayout.findOne({
            where: { order_id: String(order.id) },
          });
          if (!catched) {
            console.log(order)
            // await db.models.ReferralPayout.create({
            //   address: kid.address.toLowerCase(),
            //   order_id: order.id,
            //   tx_hash: order.user_payment_tx_hash,
            //   paid: false,
            // });
          }
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
});
