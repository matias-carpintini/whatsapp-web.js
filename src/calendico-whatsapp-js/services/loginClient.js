const { initializeWhatsAppClient } = require('./whatsappService');
const { getClient, removeClient } = require('./../clients/ClientsConnected');
const { getClientInitializing, addClientInitializing } = require('./../clients/ClientsInitializingSession');

const { saveDataClient, removeDataClient } = require('./../services/client');

function loginClient(location_identifier, user_id, slug, res) {
    if (!location_identifier) {
        console.log(`loginClient/noLocationID error`);
        return res.status(400).json({success: false, message: 'The location identifier is required'});
    }
    
    try {
        const client = getClient(location_identifier);
        if (client === undefined) {
            //if (getClientInitializing(location_identifier)) {
                // already?
            //}
            console.log(`[login] client unexists. Creating ${location_identifier} by user_id: ${user_id} and slug: ${slug}`);
            initializeWhatsAppClient(location_identifier, user_id, slug);
        } else {
            try {
                console.log(`[login] client exists. Using process for ${location_identifier} by user_id: ${user_id} and slug: ${slug}`);
                
                client.initialize();
                saveDataClient(location_identifier, user_id, slug, 'initializing')
            } catch (error) {
                console.error('[login] initialize existing client failed.', error);
                removeClient(location_identifier);
                removeDataClient(location_identifier);
                return res.status(500).json({success: false, message: 'Error initializing client. Please try asking for the QR code again'});
            }
        }
        res.status(200).json({code: 200, status: 'success', body: `Initialization process started for ${location_identifier}`});
    } catch (error) {
        console.error('[login] error:', error);
        res.status(500).json({success: false, message: 'Error during login process'});
    }
}

module.exports = { loginClient };