const db = require('../database');

db.connection.authenticate().then(async () => {
  try {
    await db.models.Order.update(
      {
        execute_date: '2023-12-04',
        order_complete: false,
        status: 'created',
        end_index_price: null,
        settlement_date: null,
        payout_base: null,
        payout_usdc: null,
        payout_tx: null,
        order_executed: null,
        payout_currency: null,
      },
      {
        where: {
          [db.Op.or]: [
            {
              from: '0x05528440b9e0323D7CCb9Baf88b411CE481694a0'.toLowerCase(),
            },
            {
              from: '0x1fDC1C823c156917F6166efc921A892D627C22A1'.toLowerCase(),
            },
          ],
          [db.Op.or]: [
            {
              chain_id: 80001,
            },
            {
              chain_id: 421613,
            },
          ],
          [db.Op.and]: [
            { execute_date: { [db.Op.gt]: '2023-12-03' } },
            // { execute_date: { [db.Op.lt]: '2023-11-18' } },
          ],
        },
      }
    );
    console.log('done');
  } catch (e) {
    console.log(e);
  }
});
