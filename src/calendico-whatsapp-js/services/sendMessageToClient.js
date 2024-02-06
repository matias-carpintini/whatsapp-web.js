const { initializeWhatsAppClient } = require('./whatsappService');
const { getClient } = require('./../clients/ClientsConnected');
const { addClientInitializing, getClientInitializing } = require('../clients/ClientsInitializingSession');

async function send_message_to_client(location_identifier, res, receiver_phone, message, message_id, dont_preview_links) {
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
            } else {
                console.log('============================================');
                console.log('Client not initialized yet. Initializing...');
                console.log('============================================');
                await initializeWhatsAppClient(location_identifier, 'automatic_reconnect');
                return res.status(400).json({
                    success: false,
                    message: 'Client not initialized yet. Please try again after re connecting the session. We\'ll try to reconnect the session automatically.'
                });
            }
        }
        const client_state = await client.getState().catch(async (error) => {
            console.error('Error getting client state:', error);
            addClientInitializing(location_identifier, client);
            await initializeWhatsAppClient(location_identifier);
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
            console.log('============================================');
            console.log('Sending message...');
            console.log('============================================');
            try {
                const messageObject = await client.sendMessage(`${receiver_phone}@c.us`, message, { linkPreview: (dont_preview_links == null) });
                let chat = await messageObject.getChat();
                const archive_result = await chat.archive();
                res.json({ 
                    success: true,
                    from: messageObject.from,
                    to: messageObject.to,
                    message_body: messageObject.body,
                    message: 'Message sent successfully',
                    message_id: message_id,
                    message_serialized_id: messageObject.id._serialized, 
                    message_status: messageObject.ack,
                    message_archived: archive_result 
                });

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
