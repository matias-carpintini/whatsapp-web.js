const mongoose = require('mongoose');
const { ClientModel } = require('./db');

function showClients(status = 'active') {
    const items = ClientModel.find().then((items) => {

        console.log(items.map((i) => i.location_id))
    })
    return items;
}

function syncExistingClients() {
    console.log('[sync] connecting client database...')
    mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1/whatsapp_js')
        .then(() => {
            console.log('[database connected]...');
        }) 
}

module.exports = { syncExistingClients, showClients }