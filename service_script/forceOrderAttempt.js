const db = require('../database');

const id = 2254;
const hash =
  '0x9bbf385ab538c76319ce9e5c9d0b3a72c22bc60b9b2171c0315c11980026c3c6';

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
