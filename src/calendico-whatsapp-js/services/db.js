const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const fs = require('fs');
const path = require('path');

const ClientSchema = new Schema({
    location_id: { type: String, index: true },
    user_id: { type: String },
    last_activity: { type: Date, default: Date.now },
    status: { type: String }, // initializing, pending, connected, idle, disconnected
  }, { 
    timestamps: true 
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
        })
        .catch((err) => {
            console.error('Error dropping database:', err);
        });
}  
showClientsDB = async function() {
    const items = await ClientModel.find();
    return items;
}
removeSession = async function(id) {
    console.log(`removing client... ${id}`)
    const c = await ClientModel.deleteMany({ location_id: id});
    return c;
}  
removeSessionFiles = async function(id) {
    let dataPath = path.resolve(process.env.AUTH_PATH || './.wwebjs_auth/');
    if (id){
        dataPath = path.join(dataPath, `session-${id}`);
    }
    console.log(`removing session files... ${dataPath}`)
    await fs.promises.rm(dataPath, { recursive: true, force: true })
        .catch(() => {
            console.log(`Error: Cannot remove the session files on ${dataPath}`)
        });
}  
removeTestClient = async function() {
    console.log('removing test client...')
    const c = await ClientModel.deleteMany({ location_id: 'test'});
    return c;
}  
createTestClient = async function() {
    console.log('creating test client...')
    const c = await ClientModel.create({ location_id: 'test', user_id: 'test', status: 'initializing' });
    return c;
}  

module.exports = { closeDB, restartDB, removeTestClient, showClientsDB, removeSession, removeSessionFiles, ClientModel } 