require('dotenv').config({ path: '../../.env' });

const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./endpoints/routes'); // Import the routes
const { showClients, syncExistingClients } = require('./services/loginClient')
const app = express();
app.use(require("express-status-monitor")());
app.use(bodyParser.json());

// Use the routes from the routes file
app.use('/', routes);

syncExistingClients();

setInterval(() => {
    const c = showClients()
    if (c.length > 0) {
        console.log(`[Active clients] ${c.length} => ${c}`)
    }
}, 30000)

const PORT = process.env.PORT || 8093;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
