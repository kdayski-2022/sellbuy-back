const db = require('../database');

const id = 2706;
const hash =
  '0x9ad22ec11dbd8071fbccafc3b595edfb6054c35b5832c2d41b0a2da230557c88';

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
