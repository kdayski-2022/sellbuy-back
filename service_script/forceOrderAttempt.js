const db = require('../database');

const id = 1729;
const hash =
  '0x24a22a40261bac524a782b5a86ed961bf399a0bdcd0c6debae7a6edd2bd84db2';

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
