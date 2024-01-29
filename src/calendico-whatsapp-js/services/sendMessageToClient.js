const { initializeWhatsAppClient } = require('./whatsappService');
const { getClient } = require('./../clients/ClientsConnected');
const { getClientInitializing } = require('../clients/ClientsInitializingSession');

async function send_message_to_client(location_identifier, res, receiver_phone, message) {
    try {
        const client = getClient(location_identifier);
        if (!client || getClientInitializing(location_identifier)) {
            if (getClientInitializing(location_identifier)) {
                console.log('============================================');
                console.log('Client is already initializing...');
                console.log('============================================');
                return res.status(400).json({
                    success: false,
                    message: 'Client is already initializing. Please try again in a few seconds.'
                });
            }
            // Initialize client if not already done
            console.log('============================================');
            console.log('Client not initialized yet. Initializing...');
            console.log('============================================');
            await initializeWhatsAppClient(location_identifier, 'automatic_reconnect');
            return res.status(400).json({
                success: false,
                message: 'Client not initialized yet. Please try again after re connecting the session. We\'ll try to reconnect the session automatically.'
            });
        }
        const client_state = await client.getState().catch(error => {
            console.error('Error getting client state:', error);
            return res.status(500).json({success: false, message: 'Error getting client state'});
        });
        console.log('============================================');
        console.log('client.getState():', client_state);
        console.log('============================================');
        if (client_state === null || client_state === 'CONFLICT' || client_state === 'UNPAIRED' || client_state === 'UNLAUNCHED') {
            await initializeWhatsAppClient(location_identifier);
            return res.status(400).json({
                success: false,
                message: 'Client session expired. Please try again in a few seconds.'
            });
        } else {
            try {
                const messageObject = await client.sendMessage(`${receiver_phone}@c.us`, message);
                let chat = await messageObject.getChat();
                console.log('============================================');
                console.log('message:', message);
                console.log('===================###########==========');
                console.log('message ACK:', messageObject.ack);
                console.log('============================================');
                const archive_result = await chat.archive();
                console.log(`archive_result: ${archive_result}`);
                //chat = await messageObject.getChat();
                console.log('============================================');
                console.log('messageObject:', messageObject);
                console.log('============================================');
                res.json({ 
                    success: true,
                    from: messageObject.from,
                    to: messageObject.to,
                    message_body: messageObject.body,
                    message: 'Message sent successfully', 
                    message_serialized_id: messageObject.id._serialized, 
                    message_status: messageObject.ack });

            } catch (error) {
                console.error('Error:', error);
                res.status(500).json({ success: false, message: 'Error sending message' });
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({success: false, message: 'Error sending message'});
    }
}

module.exports = { send_message_to_client };
