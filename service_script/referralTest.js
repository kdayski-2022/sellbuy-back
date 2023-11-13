const db = require('../database');
const { DECIMALS } = require('../config/network');
const { convertFloatToBnString, removeLeadingZeros } = require('../lib/lib');
const dotenv = require('dotenv');
dotenv.config();
const REF_FEE = process.env.REF_FEE;

db.connection.authenticate().then(async () => {
  try {
    // await db.models.ReferralPayout.update({ paid: false }, { where: {} });

    // await db.models.User.update(
    // { ref_user_id: 15 },
    // { where: { ref_user_id: 26 } }
    // );

    return 'true';
  } catch (e) {
    console.log(e);
  }
});
