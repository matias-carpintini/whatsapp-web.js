const mongoose = require('mongoose');

function showClients(status = 'active') {
    console.log(`showing ${status} clients...`)
    return []
}

function syncExistingClients() {
    console.log('[sync] connecting client database...')
    mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1/whatsapp_js')
        .then(() => {
            console.log('[database connected]...');
        }) 
}

module.exports = { syncExistingClients, showClients }