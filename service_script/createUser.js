const db = require('../database');
const crypto = require('crypto');
const { createOrUpdateUserPointsHistory } = require('../lib/user');

const address = '0xac7ea0e72d688412d3965937b703ca8d34bf7bf2';
const ref_user_id = 72;

const generateRef = async () => {
  let ref_code = crypto.randomBytes(3).toString('hex');
  let user = await db.models.User.findOne({
    where: {
      ref_code,
    },
  });
  if (!user) {
    return ref_code;
  } else {
    for (let i = 0; i < 5; i++) {
      ref_code = crypto.randomBytes(3).toString('hex');
      user = await db.models.User.findOne({
        where: {
          ref_code,
        },
      });
      if (!user) {
        break;
      }
    }
    return ref_code;
  }
};

db.connection.authenticate().then(async () => {
  try {
    ref_code = await generateRef();
    await db.models.User.create({
      ref_user_id,
      address,
      ref_code,
    });
    await createOrUpdateUserPointsHistory(address);
  } catch (e) {
    console.log(e);
  }
});
