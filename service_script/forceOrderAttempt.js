const db = require('../database');

const id = 2466;
const hash =
  '0x4401f4d6e9fa39383d78f9ab511c743ba56404ae988c30b3af6365e12a75de0d';

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
