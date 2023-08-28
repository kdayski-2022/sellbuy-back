const db = require('../database');

const id = 2361;
const hash =
  '0xf5a9932afa810b66c02c29b10f9ffdbf75594eafa87f9dda5aaba605cae19083';

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
