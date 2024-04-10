require('dotenv').config({ path: '../../.env' });

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const routes = require('./endpoints/routes'); // Import the routes
const { db, ClientModel } = require('./services/db')
const { showClients } = require('./services/client')
const { initializeWhatsAppClient } = require('./services/whatsappService')

const database = new db();
const app = express(); 


function syncExistingClients() {
    const conn = mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1/whatsapp_js')
    conn.then(async () => {
        console.log('[database connected]...');
        const items = await ClientModel.find()
        items.map(async (i) => {
            console.log(`[sync] found client: ${i.location_id} / ${i.user_id}`);
            await initializeWhatsAppClient(i.location_id, i.user_id);
            })
        })
}

function terminate(signal) { 
    console.log(`Received ${signal}. Closing server...`);
    process.exit(0); return;
    database.close().then(() => {
        console.log('Database disconnected. Exiting process...');
        process.exit(0);
    });
}

app.use(require("express-status-monitor")());
app.use(bodyParser.json());

// Use the routes from the routes file
app.use('/', routes);

syncExistingClients();

setInterval(() => {
    showClients('active')
}, 30000)

const PORT = process.env.PORT || 8093;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
process.setMaxListeners(3);
process.on('SIGINT', () => terminate('SIGINT'));
process.on('SIGTERM', () => terminate('SIGTERM'));

