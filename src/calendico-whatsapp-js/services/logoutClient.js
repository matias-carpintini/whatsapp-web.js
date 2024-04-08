const { getClient } = require('./../clients/ClientsConnected');
const axios = require('axios');
const { railsAppBaseUrl } = require('./../config/railsAppConfig');

async function logoutClient(location_identifier, user_id, res) {
    if (!location_identifier || !user_id) {
        console.log(`logoutClient/ locationId: ${location_identifier}, user_id: ${user_id}`);
        return res.status(400).json({success: false, message: `The location identifier and user_id are required. location_identifier: ${location_identifier}, user_id: ${user_id}`});
    }

    try {
        const client = getClient(location_identifier);
        if (!client) {
            console.log(`logoutClient/ There is no client with this locationId: ${location_identifier}`)
            return res.status(400).json({success: false, message: `There is no client with this location_identifier: ${location_identifier}`});
        }
        else {
            console.log(`logoutClient/ Logging out client`, client.info)
            await client.logout();
            const client_number = client.info.wid.user;
            const client_platform = client.info.platform;
            const client_pushname = client.info.pushname;
            await axios.post(`${railsAppBaseUrl()}/new_login`, {
                event_type: 'logout',
                user_id: user_id,
                phone: client_number,
                location_identifier: location_identifier,
                client_platform: client_platform,
                client_pushname: client_pushname
            }).catch(error => {
                console.error('logoutClient/ Error sending ready event to rails app:', error);
            });
            res.status(200).json({code: 200, status: 'success', body: `The session for ${location_identifier} was closed successfully. Asked by user_id: ${user_id}`});
        }
    } catch (error) {
        console.error('logoutClient/catch/ Error in logout process:', error);
        res.status(500).json({success: false, message: `'Error during logout process. Error: ${error}`});
    }
}

module.exports = { logoutClient };