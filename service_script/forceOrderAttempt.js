const db = require('../database');

const id = 2186;
const hash =
  '0xdab23a67dcc98ec7a2eb79ed9121a8a1c00cc10071d2e985ceb8b680792ff338';

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
