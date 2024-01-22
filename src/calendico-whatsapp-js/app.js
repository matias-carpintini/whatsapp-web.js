const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./endpoints/routes'); // Import the routes

const app = express();
app.use(bodyParser.json());

// Use the routes from the routes file
app.use('/', routes);

const PORT = process.env.PORT || 8093;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
