const Router = require('express');
const router = new Router();
const priceController = require('../controllers/price.controller');
const dateController = require('../controllers/date.controller');
const orderController = require('../controllers/order.controller');
const periodController = require('../controllers/period.controller');
const strikeController = require('../controllers/strike.controller');
const adminPanel = require('../controllers/adminPanel.controller');
const sessionController = require('../controllers/session.controller');
const chatController = require('../controllers/chat.controller');

router.get('/dates', dateController.getDates);

router.get('/user_orders', orderController.getUserOrders);
router.get('/order', orderController.getOrder);
router.post('/order', orderController.postOrder);

router.get('/periods', periodController.getPeriods);
router.get('/periods_price', periodController.getPricePeriods);

router.get('/price', priceController.getCurrentPrice);
router.get('/prices/sell', priceController.getSellPrices);
router.get('/prices/buy', priceController.getBuyPrices);

router.get('/strikes', strikeController.getStrikes);

router.get('/session', sessionController.create);
router.get('/chat', chatController.getChat);

router.post('/login', adminPanel.login);

module.exports = router;
