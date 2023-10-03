const db = require('../database');

const id = 2535;
const hash =
  '0x188ecae67f2c82a87f444beef1af8e2f8370bcb495fdfd9b92fc19d1b0909e14';

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
