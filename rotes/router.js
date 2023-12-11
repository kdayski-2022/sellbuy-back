const Router = require('express');
const router = new Router();
const priceController = require('../controllers/price.controller');
const dateController = require('../controllers/date.controller');
const orderController = require('../controllers/order.controller');
const orderAttemptController = require('../controllers/orderAttempt.controller');
const periodController = require('../controllers/period.controller');
const strikeController = require('../controllers/strike.controller');
const adminPanel = require('../controllers/adminPanel.controller');
const sessionController = require('../controllers/session.controller');
const configController = require('../controllers/config.controller');
const chatController = require('../controllers/chat.controller');
const statsController = require('../controllers/stats.controller');
const userController = require('../controllers/user.controller');
const airdropController = require('../controllers/airdrop.controller');
const emailController = require('../controllers/email.controller');

// Admin
router.post('/login', adminPanel.login);
router.post('/referral/make_payment', adminPanel.makeReferralPayment);
router.get('/expiration/prediction', adminPanel.getExpirationPrediction);
router.get('/expiration', adminPanel.getExpiration);
router.post('/expiration', adminPanel.postExpiration);
router.get('/admin/statistics', adminPanel.getAdminStatistics);
router.get('/stats/income', adminPanel.getIncome);
router.put('/order_crud/:id', adminPanel.updateOrder);
router.get('/order_crud', adminPanel.getOrders);
router.get('/user_crud', adminPanel.getUsers);
router.put('/user_crud/:id', adminPanel.updateUser);
router.get('/referral_payout_crud', adminPanel.getReferralPayout);
router.put('/referral_payout_crud/:id', adminPanel.updateReferralPayout);

router.get('/admin/config', adminPanel.getConfig);
router.get('/admin/stats/activity', adminPanel.getActivity);
router.get('/admin/stats/orders/count', adminPanel.getOrdersCount);
router.get(
  '/admin/stats/orders/unique_addresses',
  adminPanel.getUniqueAddresses
);
router.get('/admin/web/statistics', adminPanel.getWebStatistics);

// App
router.get('/dates', dateController.getDates);
router.get('/user_orders', orderController.getUserOrders);
router.get('/order', orderController.getOrder);
router.post('/order_state/save', orderAttemptController.postOrderAttempt);
router.post('/order_state/update', orderAttemptController.updateOrderAttempt);
router.post('/order_state/get', orderAttemptController.getOrderAttempt);
router.get('/periods_price', periodController.getPricePeriods);
router.get('/price', priceController.getCurrentPrice);
router.get('/prices/:direction', priceController.getPrices);
router.get('/strikes', strikeController.getStrikes);
router.get('/session', sessionController.create);
router.get('/chat', chatController.getChat);
router.get('/ref/:address', userController.getRef);
router.get('/unsubscribe/:hash', userController.unsubscribe);
router.get('/user_points/:address', userController.getUserPoints);
router.post('/ref_code/:ref_code', userController.addReferral);
router.post('/utm', userController.addUtm);
router.get('/leaderboard', userController.getLeaderboard);
router.get('/subscribtion/:address', userController.getSubscription);
router.post('/subscribtion/:address', userController.postSubscription);
router.get('/airdrop', airdropController.getAirdrop);
router.get('/airdrop/:address', airdropController.getAirdropParticipant);
router.post('/airdrop/:address', airdropController.addParticipantToAirdrop);
router.put('/airdrop/:address', airdropController.updateAirdropParticipant);
router.post('/email/expiration', emailController.sendMailingList);
router.post('/email/:address', emailController.sendPersonalEmail);
router.get('/config', configController.getConfig);

// Web
router.get('/stats/activity', statsController.getActivity);
router.get('/stats/orders/count', statsController.getOrdersCount);
router.get(
  '/stats/orders/unique_addresses',
  statsController.getUniqueAddresses
);
router.get('/web/statistics', statsController.getWebStatistics);
// router.get('/web/current_offer/:direction', statsController.getCurrentOffer);
router.post('/ambassador', userController.addAmbassador);
router.post('/club', userController.addClubMember);

module.exports = router;
