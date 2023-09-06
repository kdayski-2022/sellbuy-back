const db = require('../database');

const id = 2404;
const hash =
  '0x8258ca795dadc954472e38fa75f60574c56a263342ee938878cf2895a656872c';

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
