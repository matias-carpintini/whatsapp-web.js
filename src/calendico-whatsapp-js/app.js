require('dotenv').config({ path: '../../.env' });

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const routes = require('./endpoints/routes'); // Import the routes
const { closeDB, ClientModel } = require('./services/db')
const { syncDisconnected, checkIdleClients } = require('./services/client')
const { initializeWhatsAppClient } = require('./services/whatsappService')

const app = express(); 


function syncExistingClients() {
    const dbUrl = process.env.DB_URL || 'mongodb://127.0.0.1/whatsapp_js';
    const conn = mongoose.connect(dbUrl)
    conn.then(async () => {
        console.log(`[database connected]... => ${dbUrl}`);
        const items = await ClientModel.find()
        items.map(async (i, index) => {
                console.log(`[sync] found client: ${i.location_id} / ${i.user_id} with status: ${i.status}`);
                if (i.status != 'disconnected' && i.status != 'idle' && i.status != 'maxQrCodesReached'){
                    await initializeWhatsAppClient(i.location_id, i.user_id);
                }
            })
        })
}

function terminate(signal) { 
    console.log(`Received ${signal}. Closing server...`);
    closeDB().then(() => {
        console.log('Database disconnected. Exiting process...');
        process.exit(0);
    });
}

app.use(require("express-status-monitor")());
app.use(bodyParser.json());

// Use the routes from the routes file
app.use('/', routes);

syncExistingClients();

// check current connections every 1 minute(s)
const checkIntervalMs = process.env.CHECK_INTERVAL || 60*1000;
console.log(`Setting interval to sync clients: ${checkIntervalMs} ms`)
setInterval(() => { 
    checkIdleClients()
}, checkIntervalMs)

// disconnect old connections to rails between 5 minutes
setTimeout(() => {
    syncDisconnected()
}, 30000);

const discIntervalMs = process.env.DISCONNECT_INTERVAL || 5*60*1000;
console.log(`Setting interval to sync clients: ${discIntervalMs*1000} seconds`)
setInterval(() => { 
    syncDisconnected()
}, discIntervalMs)


const PORT = process.env.PORT || 8093;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
process.setMaxListeners(20);
process.on('SIGINT', () => terminate('SIGINT'));
process.on('SIGTERM', () => terminate('SIGTERM'));

