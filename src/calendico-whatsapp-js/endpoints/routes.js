const express = require('express');
const router = express.Router();
const { send_message_to_client } = require('../services/sendMessageToClient');
const { loginClient } = require('../services/loginClient');
const { logoutClient } = require('../services/logoutClient');
const { getChats } = require('../services/getChats');
const { getContacts } = require('../services/getContacts');
const { restartDB, removeSession, removeSessionFiles, removeTestClient, showClientsDB } = require('../services/db');

// Endpoint to send a message
router.post('/send_message', async (req, res) => {
    const { location_identifier, receiver_phone, message, message_id, dont_preview_links, dont_archive_chat } = req.body;
    console.log(`[route/send_message] locationId ${location_identifier}`, 
    `receiver_phone: ${receiver_phone}`, 
    `dont_archive?: type(${typeof dont_archive_chat}): ${dont_archive_chat}`, 
    `message: ${message.substr(0, 30)}...`); 
    
    return await send_message_to_client(location_identifier, res, receiver_phone, message, message_id, dont_preview_links, dont_archive_chat);
});
router.get('/', (req, res) => {
    res.send('ACK');
});

router.get('/db_remove_session/:id', (req, res) => {
    try {
        if (!req.params.id){
            return res.status(400).send('Error: No session id provided')
        }
        removeSession(req.params['id']);
        removeSessionFiles(req.params['id'])
        res.send('Removing session OK')
    } catch (e) {
        console.error('db_remove_session_error: ', e);
        res.status(500).send('Error execution. Check the log reports.', e)
    }
})
router.get('/db_restart', (req, res) => {
    try {
        restartDB();
        if (req.query.clean === 'CLEAN') {
            removeSessionFiles();
        }
        res.send('Restart done')
    } catch (e) {
        console.error('db_restart_error: ', e);
        res.status(500).send('Error execution. Check the log reports.', e)
    }
})
router.get('/db_remove_test', async (req, res) => {
    try {
        await removeTestClient();
        res.send('OK')
    } catch (e) {
        console.error('db_remove_test_error: ', e);
        res.status(500).send('Error execution. Check the log reports.')
    }
})
router.get('/show_clients', async (req, res) => {
    const items = await showClientsDB();
    return res.send(items);
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
