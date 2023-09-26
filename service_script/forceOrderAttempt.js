const db = require('../database');

const id = 2475;
const hash =
  '0xfafb2a534e3f1aba1f95925bf086bef880d396c3bd34f9eadef2f7088d3d1164';

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
