const db = require('../database');

db.connection.authenticate().then(async () => {
  try {
    // await db.models.Order.update(
    //   {
    //     execute_date: '2023-11-14',
    //     order_complete: false,
    //     status: 'created',
    //     end_index_price: 1850,
    //     settlement_date: null,
    //     payout_base: null,
    //     payout_usdc: null,
    //     payout_tx: null,
    //     order_executed: null,
    //     payout_currency: null,
    //     chain_id: 80001,
    //   },
    //   {
    //     where: {
    //       [db.Op.and]: [
    //         { execute_date: { [db.Op.gt]: '2023-11-09' } },
    //         { execute_date: { [db.Op.lt]: '2023-11-18' } },
    //       ],
    //     },
    //   }
    // );
    console.log('done');
  } catch (e) {
    console.log(e);
  }
});
