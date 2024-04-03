const db = require('../database');

const id = 4563;
const hash = '0x16729324f36cd62638509b2a21720a4d8250cb3f55d0add4fdf3ae58625ac966';

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
