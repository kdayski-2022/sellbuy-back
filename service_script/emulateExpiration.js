// await db.models.Order.update(
//   { status: 'pending_approve', chain_id: 80001 },
//   {
//     where: {
//       [db.Op.and]: [
//         { execute_date: { [db.Op.gt]: '2023-11-02' } },
//         { execute_date: { [db.Op.lt]: '2023-11-04' } },
//       ],
//     },
//   }
// );
// const orders = await db.models.Order.findAll({
//   where: { status: 'pending_approve' },
// });
// try {
//   const res = await axios.post(
//     'http://dev.fanil.ru:5111/api/expiration',
//     {
//       orders,
//       tx: '0x022b935c8ae6e92ca72903d73e2ef48e573d83cd037cfc25aec927105d3c274c',
//     },
//     {
//       headers: {
//         Accept: 'application/json',
//         'Content-Type': 'application/json',
//       },
//     }
//   );
//   console.log(res);
// } catch (e) {
//   console.log(e);
// }
// resetOrders();
