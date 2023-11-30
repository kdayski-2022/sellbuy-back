const db = require('../database');

const id = 3008;
const hash =
  '0x0046e3a46590596d0ec38aeaf7d5ab965b20607cf895e670d7479b985e79eca9';

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
