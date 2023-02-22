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
const chatController = require('../controllers/chat.controller');
const statsController = require('../controllers/stats.controller');

router.get('/dates', dateController.getDates);

router.get('/user_orders', orderController.getUserOrders);
router.get('/order', orderController.getOrder);
router.post('/order', orderController.postOrder);
router.put('/order_crud/:id', orderController.updateOrder);
router.get('/order_crud', orderController.getOrders);
router.get('/expiration', orderController.getExpiration);

router.post('/order_state/save', orderAttemptController.postOrderAttempt);
router.post('/order_state/update', orderAttemptController.updateOrderAttempt);

router.get('/periods', periodController.getPeriods);
router.get('/periods_price', periodController.getPricePeriods);

router.get('/price', priceController.getCurrentPrice);
router.get('/prices/sell', priceController.getSellPrices);
router.get('/prices/buy', priceController.getBuyPrices);

router.get('/strikes', strikeController.getStrikes);

router.get('/session', sessionController.create);
router.get('/chat', chatController.getChat);

router.post('/login', adminPanel.login);

router.get('/stats/income', statsController.getIncome);

router.get('/web/statistics', statsController.getWebStatistics);
router.get('/admin/statistics', statsController.getAdminStatistics);

module.exports = router;
