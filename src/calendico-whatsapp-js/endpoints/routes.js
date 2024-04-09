const express = require('express');
const router = express.Router();
const { send_message_to_client } = require('../services/sendMessageToClient');
const { loginClient, showClients } = require('../services/loginClient');
const { logoutClient } = require('../services/logoutClient');
const { getChats } = require('../services/getChats');
const { getContacts } = require('../services/getContacts');

// Endpoint to send a message
router.post('/send_message', async (req, res) => {
    const { location_identifier, receiver_phone, message, message_id, dont_preview_links, dont_archive_chat } = req.body;
    console.log(`[route/send_message] locationId ${location_identifier}`, `receiver_phone: ${receiver_phone}`, `message: ${message.substr(0, 30)}...`); 
    return await send_message_to_client(location_identifier, res, receiver_phone, message, message_id, dont_preview_links, dont_archive_chat);
});

router.get('/show_clients', (req, res) => {
    return res.send(showClients());
})
router.post('/login', (req, res) => {
    const { location_identifier,  user_id } = req.body;
    console.log(`[route/login] locationId ${location_identifier}, user_id: ${user_id}`);
    return loginClient(location_identifier, user_id, res);
});

router.delete('/logout', async (req, res) => {
    const { location_identifier, user_id } = req.body;
    console.log(`[route/logout] locationId ${location_identifier}, user_id: ${user_id}`); 
    return await logoutClient(location_identifier, user_id, res);
});

router.get('/chats', async (req, res) => {
    const { location_identifier, chats_to_get } = req.query;
    console.log(`[route/chats] locationId ${location_identifier}`); 
    return await getChats(location_identifier, chats_to_get, res);
});

router.get('/contacts', async (req, res) => {
    const { location_identifier } = req.query;
    console.log(`[route/contacts] locationId ${location_identifier}`); 
    return await getContacts(location_identifier, res);
});

module.exports = router;
