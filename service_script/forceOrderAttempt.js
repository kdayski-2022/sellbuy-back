const db = require('../database');

const id = 2634;
const hash =
  '0xa204a06a23aa23dbb2dc315db1d452a81d2031dee0e7593670c9c2336e251383';

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
