const db = require('../database')
var empty = require('is-empty')
const session = require('./session.controller.js')
const md5 = require('md5')
const dotenv = require('dotenv');
dotenv.config();
const md5Salt = process.env.md5Salt;

const AdminPanel = {
    login: async (req, res) => {
        const { username, password } = req.body;
        let allow = false
        let accessToken
        let manager
        if (!empty(username) && !empty(password)) {
            manager = await db.models.Manager.findOne({
                where: {
                    login: username,
                    password: md5(md5Salt + password)
                }
            })
            console.log(await db.models.Manager.findAll())
            if (!empty(manager)) {
                allow = true
                var d = new Date()
                d.setDate(d.getDate() - 14)
                await db.models.ManagerSession.destroy({
                    where: {
                        createdAt: {
                            [db.Op.lte]: d
                        }
                    }
                })
                accessToken = session.generateToken()
                await db.models.ManagerSession.create(
                    {
                        managerId: manager.id,
                        accessToken
                    }
                )
            }
        }
        if (allow) {
            res.send({ token: accessToken, role: manager.role })
        } else {
            res.status(401).send('invalid password')
        }
    }
}

module.exports = AdminPanel