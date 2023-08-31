const db = require('../database');

const id = 2370;
const hash =
  '0xaf67d951c8dd36d3d13f1e35a94f6785bf1114ccedf1b7b054a16edf76852346';

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
