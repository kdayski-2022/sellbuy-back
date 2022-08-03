const axios = require('axios')
const dotenv = require('dotenv');
dotenv.config();
const apiUrl = process.env.API_URL;

class UserController{
    async getBalance(req, res){
        axios.get(`${apiUrl}/public/get_account_summary?currency=ETH`).then((apiRes) =>{
            try{
                
            }
            catch(e){
                throw new Error(e.message)
            }
        })
    }

}

module.exports = new UserController()
