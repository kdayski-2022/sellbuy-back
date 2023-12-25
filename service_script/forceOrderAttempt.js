const db = require('../database');

const id = 3288;
const hash =
  '0x7064fb2b34836c7c6315bc1915ba4aa32bc1a53616f470999ff7fc1851c04e4b';

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
