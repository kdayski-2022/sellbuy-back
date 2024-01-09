const db = require('../database');

const id = 3398;
const hash =
  '0xb355802cfdf1bd79537e8f196badb66bf367a871f66409b788f9edc2afd4cf5c';

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
