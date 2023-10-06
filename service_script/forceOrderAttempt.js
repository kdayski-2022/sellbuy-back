const db = require('../database');

const id = 2550;
const hash =
  '0x5e05fc515aa551c4c1d300ec5ccb0cd928d069a85326d8c7abed5abc3a36d69d';

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
