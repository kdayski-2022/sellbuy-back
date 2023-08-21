const db = require('../database');

const id = 2327;
const hash =
  '0x9825651f58a30239d4b262f0eaf6f0b98bf052027db81764599e4b16e6d2a7da';

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
