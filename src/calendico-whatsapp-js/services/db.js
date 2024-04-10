const mongoose = require('mongoose');
const Schema = mongoose.Schema;

class db {
    constructor(){
        const ClientSchema = new Schema({
            location_id: { type: String, index: true },
            user_id: { type: String },
            date: { type: Date, default: Date.now },
          });
          const ClientModel = mongoose.model('Client', ClientSchema);
    };
    close = async function() {
        return mongoose.disconnect()
    }
    restart = function() {
        console.log('running restart...')
        mongoose.connection.dropDatabase()
            .then(() => {
                console.log('Database dropped successfully');
                this.createTestClient();
                // mongoose.disconnect();
            })
            .catch((err) => {
                console.error('Error dropping database:', err);
            });
    }  
    createTestClient = async function() {
        console.log('creating client...')
        const c = await this.ClientModel({ location_id: 'test', user_id: 'test' });
        return c;
    }  
}
module.exports = db