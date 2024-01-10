const db = require('../database');

const fillReferralLinks = async () => {
  try {
    const users = await db.models.User.findAll({
      where: { ref_code: { [db.Op.ne]: null } },
    });
    let cnt = 0;
    for (const user of users) {
      const ref_code_list = JSON.parse(JSON.stringify(user.ref_code_list));
      if (!ref_code_list.includes(user.ref_code)) {
        ref_code_list.push(user.ref_code);

        await db.models.User.update(
          { ref_code_list },
          {
            where: { id: user.id },
          }
        );
        cnt++;
      }
    }
    console.log(cnt);
    console.log('success');
  } catch (e) {
    console.log(e);
  }
};

db.connection.authenticate().then(async () => {
  try {
    await fillReferralLinks();
  } catch (e) {
    console.log(e);
  }
});
