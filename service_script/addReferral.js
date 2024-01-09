const db = require('../database');
const crypto = require('crypto');

const ref_code = 'bb1d31';
const address = '0x2335e0b50ed2216a8fb51d7f298042f6adefe978';

const addReferral = async () => {
  try {
    console.log(ref_code);
    const user = await db.models.User.findOne();
    console.log(user);
    console.log(typeof user.ref_code_list);
    console.log(user.ref_code_list.includes('123'));
    let parent = await db.models.User.findOne({
      where: {
        [db.Op.or]: [
          { ref_code },
          { ref_code_list: { [db.Op.contains]: [ref_code] } },
        ],
      },
    });
    let referral = await db.models.User.findOne({
      where: {
        address,
      },
    });
    if (!referral) {
      referral = await createUser(address);
    }
    if (!referral.ref_user_id && parent && parent.ref_user_id !== referral.id) {
      await updateUser(referral, { ref_user_id: parent.id });
    }

    console.log('success');
  } catch (e) {
    console.log(e);
  }
};

db.connection.authenticate().then(async () => {
  try {
    await addReferral();
  } catch (e) {
    console.log(e);
  }
});
