const express = require('express')
const axios = require('axios')
const useRouter = require('./rotes/transaction.rotes')
const dotenv = require('dotenv');
dotenv.config();

const PORT = process.env.PORT || 8080

const app = express()
app.use(express.json())
app.use('/api', useRouter)

app.listen(PORT, () => {
	// axios.post(`http://localhost:${PORT}/api/order`, {amount: 1, hash: "0xc21efc9a1f8288a6e7b7f5eae2d9c7fc3fce9485f129b08c2d0b2b262c5fc040"}).then((res) => console.log(res.data))
	// axios.get(`http://localhost:${PORT}/api/order`, {params: {period: 1659099631000, price: 1100, amount: 1}}).then((res) => console.log(res.data))
	console.log(`listen on port ${PORT}`)
})