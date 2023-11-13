const db = require('../database');
const { DECIMALS } = require('../config/network');
const { convertFloatToBnString, removeLeadingZeros } = require('../lib/lib');
const dotenv = require('dotenv');
dotenv.config();
const REF_FEE = process.env.REF_FEE;

db.connection.authenticate().then(async () => {
  try {
    const referralPayouts = await db.models.ReferralPayout.findAll({
      where: { paid: false },
    });
    const validPayouts = [];
    for (const referralPayout of referralPayouts) {
      const order = await db.models.Order.findOne({
        where: { id: referralPayout.order_id },
      });
      if (order && order.status === 'approved') {
        // await db.models.ReferralPayout.update({paid: true}, {
        //   where: { id: referralPayout.id },
        // });
        validPayouts.push(referralPayout);
      }
    }
    const addresses = [];
    let amount = [];
    for (const referralPayout of validPayouts) {
      try {
        const user = await db.models.User.findOne({
          where: { address: referralPayout.address.toLowerCase() },
        });
        const parent = await db.models.User.findOne({
          where: { id: user.ref_user_id },
        });
        let ref_fee = 0;
        if (parent && parent.ref_fee) ref_fee = parent.ref_fee;
        else ref_fee = REF_FEE || 0;
        const order = await db.models.Order.findOne({
          where: { id: referralPayout.order_id },
        });
        const appRevenue =
          (order.recieve / order.commission) * (1 - order.commission);
        const earn = (appRevenue / 100) * Number(ref_fee);
        referralPayout.app_revenue = appRevenue;
        referralPayout.earn = earn;
        referralPayout.parent = parent ? parent.address : '0x0';
      } catch (e) {
        console.log(e);
        referralPayout.app_revenue = 0;
        referralPayout.earn = 0;
        referralPayout.parent = '0x0';
      }

      const contains = addresses.findIndex(
        (address) => address === referralPayout.parent
      );
      if (contains === -1) {
        addresses.push(referralPayout.parent);
        amount.push(referralPayout.earn);
      } else {
        amount[contains] = (
          Number(amount[contains]) + Number(referralPayout.earn)
        ).toFixed(2);
      }
    }

    amount = await Promise.all(
      amount.map((item) =>
        removeLeadingZeros(convertFloatToBnString(item, DECIMALS.USDC))
      )
    );
    console.log({ addresses, amount });
    return { addresses, amount };
  } catch (e) {
    console.log(e);
  }
});
