const express = require('express');
const router = express.Router();
const { send_message_to_client } = require('../services/sendMessageToClient');
const { loginClient } = require('../services/loginClient');
const { logoutClient } = require('../services/logoutClient');

// Endpoint to send a message
router.post('/send_message', async (req, res) => {
    const { location_identifier, receiver_phone, message } = req.body;
    return await send_message_to_client(location_identifier, res, receiver_phone, message);
});

router.post('/login', (req, res) => {
    const { location_identifier,  user_id } = req.body;
    return loginClient(location_identifier, user_id, res);
});

// add a DELETE route to remove a client from the clients object
router.delete('/logout', async (req, res) => {
    const { location_identifier, user_id } = req.body;
    return await logoutClient(location_identifier, user_id, res);
});

module.exports = router;
