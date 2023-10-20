const db = require('../database');

const id = 2628;
const hash =
  '0x4f4af4305765761138f5fad5e7964e3deac11917bc3b8c4149324c5b8fe137e2';

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
