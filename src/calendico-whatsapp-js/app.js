require('dotenv').config({ path: '../../.env' });

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const routes = require('./endpoints/routes'); // Import the routes
const { closeDB, ClientModel } = require('./services/db')
const { showClients } = require('./services/client')
const { initializeWhatsAppClient } = require('./services/whatsappService')

const app = express(); 


function syncExistingClients() {
    const dbUrl = process.env.DB_URL || 'mongodb://127.0.0.1/whatsapp_js';
    const conn = mongoose.connect(dbUrl)
    conn.then(async () => {
        console.log(`[database connected]... => ${dbUrl}`);
        const items = await ClientModel.find()
        items.map(async (i) => {
            if (i.location_id == "693-322247143"){
                console.log(`[sync] found client: ${i.location_id} / ${i.user_id}`);
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
const intervalShow = process.env.INTERVAL_SHOW || 60000;
console.log(`Setting interval to show clients: ${intervalShow} ms`)
setInterval(() => {
    showClients('active')
}, intervalShow)

const PORT = process.env.PORT || 8093;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
process.setMaxListeners(20);
process.on('SIGINT', () => terminate('SIGINT'));
process.on('SIGTERM', () => terminate('SIGTERM'));

