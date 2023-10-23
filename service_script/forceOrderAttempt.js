const db = require('../database');

const id = 2660;
const hash =
  '0x12b25cec7e30cb706895fdfc20c8e7cd2644af580922e9635100d985cc7fc5c4';

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
