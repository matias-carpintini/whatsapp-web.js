const { getClient } = require('./../clients/ClientsConnected');
//const { extractNumber } = require('../utils/utilities');

async function getContacts(location_identifier, res) {
    if (!location_identifier) {
        return res.status(400).json({success: false, message: 'The location identifier is required'});
    }

    try {
        const client = getClient(location_identifier);
        if (!client) {
            return res.status(400).json({
                success: false,
                message: `There is no client with this location_identifier: ${location_identifier}`
            });
        } else {
            try {
                const contacts = await client.getContacts();
                console.log('============================================');
                console.log(`There are ${contacts.length} chats`);
                const chatJSONObject = createContactsJSONObject(contacts);
                console.log(JSON.stringify(chatJSONObject, null, 2));
                return res.status(200).json({code: 200, status: 'success', body: chatJSONObject});
            } catch (error) {
                console.error('Error creating chat JSON object:', error);
                res.status(500).json({success: false, message: `Error creating chat JSON object: ${error}`});
            }
            ;
        }
    }
    catch (error) {
        console.error('Error in getChats process:', error);
        res.status(500).json({success: false, message: 'Error during getChats process'});
    }
}

function createContactsJSONObject(contacts) {
    return contacts.map(contact => {
        return {
            contactId: contact.id,
            contactIsMe: contact.isMe,
            contactName: contact.name,
            contactPushName: contact.pushname,
            contactShortName: contact.shortName,
            contactNumber: contact.number,
            groupContact: contact.isGroup,

        };
    });
}

module.exports = { getContacts };