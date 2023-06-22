const db = require('../database');
db.connection.authenticate().then(async () => {
  const utm = await db.models.Utm.findAll({
    where: { utm: 'cdevf' },
  });
  console.log(utm.length);
});
