require('dotenv').config({ path: '../../.env' });

const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./endpoints/routes'); // Import the routes
const db = require('./services/db')
const { showClients, syncExistingClients } = require('./services/client')
const database = new db();
const app = express(); 

function terminate(signal) { 
    console.log(`Received ${signal}. Closing server...`);
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
    const c = showClients('active')
    if (c.length > 0) {
        console.log(`[Active clients] ${c.length} => ${c}`)
    }
}, 30000)

const PORT = process.env.PORT || 8093;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
process.on('SIGINT', () => terminate('SIGINT'));
process.on('SIGTERM', () => terminate('SIGTERM'));

