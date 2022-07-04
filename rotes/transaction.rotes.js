const Router = require('express')
const router = new Router()
const transactionContoller = require('../controllers/transaction.controller')
const priceContoller = require('../controllers/price.controller')
const dateContoller = require('../controllers/date.controller')
const orderContoller = require('../controllers/order.controller')
const periodContoller = require('../controllers/period.controller')
const strikeContoller = require('../controllers/strike.controller')

router.get('/dates', dateContoller.getDates)

router.get('/order', orderContoller.getOrder)
router.post('/order', orderContoller.postOrder)

router.get('/periods', periodContoller.getPeriods)

router.get('/prices', priceContoller.getPrices)
router.get('/prices/sell', priceContoller.getSellPrices)
router.get('/prices/buy', priceContoller.getBuyPrices)

router.get('/strikes', strikeContoller.getStrikes)

router.post('/transaction', transactionContoller.createTransaction)
router.get('/transactions', transactionContoller.getTransactions)
router.get('/transaction/:hash', transactionContoller.getTransaction)
router.delete('/transaction/:hash', transactionContoller.deleteTransaction)
router.delete('/transactions', transactionContoller.deleteAllTransaction)

module.exports = router