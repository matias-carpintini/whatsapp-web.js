const express = require('express');
const router = express.Router();
const { send_message_to_client } = require('../services/sendMessageToClient');
const { loginClient } = require('../services/loginClient');
const { logoutClient } = require('../services/logoutClient');
const { getChats } = require('../services/getChats');
const { getContacts } = require('../services/getContacts');
const { authMiddleware } = require('./middleware');
const Util = require('../../util/Util');
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

router.get('/db_remove_session/:id', authMiddleware, (req, res) => {
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
router.get('/db_restart', authMiddleware, (req, res) => {
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
router.get('/show_clients', authMiddleware, async (req, res) => {
    const items = await showClientsDB();
    const styles = `table { font-size: 11px; font-family: Arial, sans-serif; border-collapse: collapse; width: 100%; } th { background-color: #f2f2f2; } th, td { border: 1px solid #dddddd; text-align: left; padding: 8px; } tr:nth-child(even) { background-color: #f2f2f2; }`;
    let table = `<html><head><style type="text/css">${styles}</style></head><body>
    <table><tr><th>Location Slug</th><th>AD_JID</th><th>User ID</th><th>Status</th><th>Created</th><th>Updated</th><th>PING_IDLE</th></tr>`;

    items.forEach(item => {
        table += `<tr><td>${item.slug}</td><td>${item.location_id}</td><td>${item.user_id}</td><td>${item.status} ${Util.explainStatus(item.status)}</td><td>${item.createdAt ? Util.timeSince(new Date(item.createdAt)) + ' ago' : Util.timeSince(new Date(item.date)) + ' ago'}</td><td>${item.updatedAt ? Util.timeSince(new Date(item.updatedAt)) + ' ago' : ''}</td><td>${item.idleCounter || 0}</td></tr>`;    });
    table += '</table></body></html>';
    return res.send(table);
})

router.post('/login', (req, res) => {
    const { location_identifier, slug, user_id } = req.body;
    console.log(`[route/login] locationId ${location_identifier}, user_id: ${user_id}, slug: ${slug}`);
    return loginClient(location_identifier, user_id, slug, res);
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
