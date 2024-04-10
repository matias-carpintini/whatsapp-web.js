const { initializeWhatsAppClient } = require('./whatsappService');
const { getClient, removeClient } = require('./../clients/ClientsConnected');

function loginClient(location_identifier, user_id, res) {
    console.log(`loginClient/ Starting login process for ${location_identifier} by user_id: ${user_id}`);
    if (!location_identifier) {
        console.log(`loginClient/noLocationID error`);
        return res.status(400).json({success: false, message: 'The location identifier is required'});
    }

    try {
        const client = getClient(location_identifier);
        if (client === undefined) {
            console.log('loginClient/ Client not found in inner store. Initializing client...');
            initializeWhatsAppClient(location_identifier, user_id);
        } else {
            try {
                client.initialize();
            } catch (error) {
                console.error('loginClient/client.initialize catch/ Error initializing client:', error);
                removeClient(location_identifier);
                return res.status(500).json({success: false, message: 'Error initializing client. Please try asking for the QR code again'});
            }
        }
        console.log(`loginClient/ initialization started for locationId: ${location_identifier}`);
        res.status(200).json({code: 200, status: 'success', body: `Initialization process started for ${location_identifier}`});
    } catch (error) {
        console.error('loginClient/catch/ Error in login process:', error);
        res.status(500).json({success: false, message: 'Error during login process'});
    }
}

module.exports = { loginClient };