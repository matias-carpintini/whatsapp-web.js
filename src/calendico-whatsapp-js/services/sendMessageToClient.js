const { initializeWhatsAppClient } = require('./whatsappService');
const { getClient } = require('./../clients/ClientsConnected');

async function send_message_to_client(location_identifier, res, receiver_phone, message) {
    try {
        const client = getClient(location_identifier);
        if (!client) {
            // Initialize client if not already done
            await initializeWhatsAppClient(location_identifier);
            return res.status(400).json({
                success: false,
                message: "Client not initialized yet. Please try again after re connecting the session. We'll try to reconnect the session automatically."
            });
        }
        const client_state = await client.getState().catch(error => {
            console.error('Error getting client state:', error);
            return res.status(500).json({success: false, message: 'Error getting client state'});
        });
        console.log('============================================');
        console.log('client.getState():', client_state);
        console.log('============================================');
        if (client_state === 'CONFLICT' || client_state === 'UNPAIRED' || client_state === 'UNLAUNCHED') {
            await initializeWhatsAppClient(location_identifier);
            return res.status(400).json({
                success: false,
                message: 'Client session expired. Please try again in a few seconds.'
            });
        } else {
            try {
                const response = await client.sendMessage(`${receiver_phone}@c.us`, message);
                console.log('============================================');
                console.log('sending message response:', response);
                console.log('============================================');
                res.json({ success: true, message: 'Message sent successfully' });

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
