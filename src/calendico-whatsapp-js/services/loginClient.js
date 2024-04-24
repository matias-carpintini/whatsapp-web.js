const { initializeWhatsAppClient } = require('./whatsappService');
const { getClient, removeClient } = require('./../clients/ClientsConnected');
const { saveDataClient, removeDataClient } = require('./../services/client');

function loginClient(location_identifier, user_id, slug, res) {
    console.log(`loginClient/ Starting login process for ${location_identifier} by user_id: ${user_id} and slug: ${slug}`);
    if (!location_identifier) {
        console.log(`loginClient/noLocationID error`);
        return res.status(400).json({success: false, message: 'The location identifier is required'});
    }

    try {
        const client = getClient(location_identifier);
        if (client === undefined) {
            console.log('loginClient/ Creating client...');
            initializeWhatsAppClient(location_identifier, user_id, slug);
        } else {
            try {
                client.initialize();
                saveDataClient(location_identifier, user_id, slug, 'initializing')
                console.log(`Initialization started for locationId: ${location_identifier}`);
            } catch (error) {
                console.error('loginClient/client.initialize catch/ Error initializing client:', error);
                removeClient(location_identifier);
                removeDataClient(location_identifier);
                return res.status(500).json({success: false, message: 'Error initializing client. Please try asking for the QR code again'});
            }
        }
        res.status(200).json({code: 200, status: 'success', body: `Initialization process started for ${location_identifier}`});
    } catch (error) {
        console.error('loginClient/catch/ Error in login process:', error);
        res.status(500).json({success: false, message: 'Error during login process'});
    }
}

module.exports = { loginClient };