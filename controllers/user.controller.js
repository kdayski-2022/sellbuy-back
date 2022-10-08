const { MESSAGES } = require('../config/messages');
const db = require('../database');
const { writeLog, updateLog } = require('../lib/logger');

class UserController{
    async getBalance(req, res) {
        const logId = await writeLog({ action: 'getBalance', status: 'in progress', req })
        try {
            const { userAddress } = req.params
            let user = await db.models.User.findOne({ where: { address: userAddress.toLowerCase() } })
            if (!user) user = await db.models.User.create({ address, balance: 0 })
            updateLog(logId, { status: 'success' })
            res.json({ success: true, data: { balance: user.balance } });
        } catch(e) {
            updateLog(logId, { status: 'failed', error: JSON.stringify(e) })
            res.json({ success: false, data: null });
        }
    }

    async postBalance(req, res) {
        const logId = await writeLog({ action: 'postBalance', status: 'in progress', req })
        try {
            const { amount, address, hash } = req.body
            telegram.send(`User ${address} deposited ${amount} ETH`)
            await db.models.BalanceHistory.create({ address, tx_hash: hash, status: 'pending' })
            let user = await db.models.User.findOne({ where: { address: address.toLowerCase() } })
            if (!user) user = await db.models.User.create({ address, balance: 0 })
            updateLog(logId, { status: 'success' })
            res.json({ success: true, data: { balance: user.balance }, message: MESSAGES.TOKEN_REQUEST_PENDING });
        } catch(e) {
            updateLog(logId, { status: 'failed', error: JSON.stringify(e) })
            res.json({ success: false, data: null, error: e.message });
        }
    }
}

module.exports = new UserController()
