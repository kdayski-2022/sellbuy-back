const Router = require('express')
const router = new Router()
const priceContoller = require('../controllers/price.controller')
const dateContoller = require('../controllers/date.controller')
const orderContoller = require('../controllers/order.controller')
const periodContoller = require('../controllers/period.controller')
const strikeContoller = require('../controllers/strike.controller')
const userController = require('../controllers/user.controller')
const adminPanel = require('../controllers/adminPanel.controller')

router.get('/dates', dateContoller.getDates)

router.get('/user_orders', orderContoller.getUserOrders)
router.get('/order', orderContoller.getOrder)
router.post('/order', orderContoller.postOrder)

router.get('/periods', periodContoller.getPeriods)
router.get('/periods_price', periodContoller.getPricePeriods)

router.get('/price', priceContoller.getCurrentPrice)
router.get('/prices', priceContoller.getPrices)
router.get('/prices/sell', priceContoller.getSellPrices)
router.get('/prices/buy', priceContoller.getBuyPrices)

router.get('/strikes', strikeContoller.getStrikes)

router.get('/balance/:userAddress', userController.getBalance)
router.post('/balance', userController.postBalance)

router.post('/login', adminPanel.login)

module.exports = router