const db = require('../database');

const id = 2453;
const hash =
  '0xcbec053cbec1d7c08429232a9fc12812d58e96bfc789653003fe633505c7c09e';

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
