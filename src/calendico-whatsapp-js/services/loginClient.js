const { initializeWhatsAppClient} = require('./whatsappService');
const { getClient, removeClient } = require('./../clients/ClientsConnected');

function loginClient(location_identifier, user_id, res) {
    console.log(`Starting login process for ${location_identifier} by user_id: ${user_id}`);
    if (!location_identifier) {
        console.log('----------------------------------------------------------------------------------------------');
        console.log(`location_identifier: ${location_identifier}, user_id: ${user_id}`);
        console.log('----------------------------------------------------------------------------------------------');
        return res.status(400).json({success: false, message: 'The location identifier is required'});
    }

    try {
        const client = getClient(location_identifier);
        console.log('----------------------------------------------------------------------------------------------');
        console.log(`client: ${client}`);
        if (client === undefined) {
            console.log('Client not found in inner store. Initializing client...');
            initializeWhatsAppClient(location_identifier, user_id); // Initializes client and handles QR code
        }
        else {
            try {
                client.initialize();
            }
            catch (error) {
                console.error('Error initializing client:', error);
                removeClient(location_identifier);
                return res.status(500).json({success: false, message: 'Error initializing client. Please try asking for the QR code again'});
            }
        }
        console.log('----------------------------------------------------------------------------------------------');
        res.status(200).json({code: 200, status: 'success', body: `Initialization process started for ${location_identifier}`});
    } catch (error) {
        console.error('Error in login process:', error);
        res.status(500).json({success: false, message: 'Error during login process'});
    }
}

module.exports = { loginClient };