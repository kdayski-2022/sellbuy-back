const db = require('../database');

const id = 2339;
const hash =
  '0x734b0fc5dcaa365e73df89af77587c79df2afbb27bba8916d09eb49a04f38eda';

db.connection.authenticate().then(async () => {
  try {
    const update = await db.models.OrderAttempt.update(
      {
        hash,
        error: null,
      },
      { where: { id } }
    );
    console.log('success', update);
  } catch (e) {
    console.log(e);
  }
});
