const db = require('../database');

const id = 4140;
const hash =
  '0x86985fe7c6433ccbe512a5478fb07ffd223ada15bb6023bf352818a17aeb2f59';

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
