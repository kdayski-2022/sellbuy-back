import db from 'mysql'
import config from '../configDb/configDb.js'

const connectionDb = db.createConnection(config)

export function create(){
    connectionDb.connect(function(err){
        if(err) throw "not connected"
      
        console.log("connected")
      
        connectionDb.query("CREATE DATABASE sellbuy-back", function(err, result){
          console.log(result); 
        })
    })
}

export function insert(txHash){

}