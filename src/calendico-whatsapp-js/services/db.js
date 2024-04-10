const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ClientSchema = new Schema({
    location_id: { type: String, index: true },
    user_id: { type: String },
    date: { type: Date, default: Date.now },
  });
const ClientModel = mongoose.model('Client', ClientSchema);


closeDB = async function() {
    return mongoose.disconnect()
}
restartDB = function() {
    console.log('running restart...')
    mongoose.connection.dropDatabase()
        .then(() => {
            console.log('Database dropped successfully');
            //this.createTestClient();
        })
        .catch((err) => {
            console.error('Error dropping database:', err);
        });
}  
removeTestClient = async function() {
    console.log('removing test client...')
    const c = await ClientModel.delete({ location_id: 'test'});
    return c;
}  
createTestClient = async function() {
    console.log('creating test client...')
    const c = await ClientModel.create({ location_id: 'test', user_id: 'test' });
    return c;
}  

module.exports = { closeDB, restartDB, removeTestClient, ClientModel } 