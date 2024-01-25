const {getChats} = require('./getChats');
//const { extractNumber } = require('../utils/utilities');

async function getContacts(location_identifier, res) {
    if (!location_identifier) {
        return res.status(400).json({ success: false, message: 'The location identifier is required' });
    }

    try {
        const chats = await getChats(location_identifier, 1, res, true);
        console.log('============================================');
        console.log(`There are ${chats.length} chats`);
        console.log('============================================');
        let contacts = [];

        for (const chat of chats) {
            const contact = await chat.getContact();
            const contact_info = contactPresenter(contact);
            contacts.push(contact_info);
        }

        console.log('--------------');
        console.log('Contacts array:');
        console.log(contacts);
        console.log('--------------');
        return res.status(200).json({ code: 200, status: 'success', body: contacts });
    } catch (error) {
        console.error('Error in getChats process:', error);
        res.status(500).json({ success: false, message: 'Error during getContacts process' });
    }
}

function contactPresenter(contact) {
    return {
        id: contact.id,
        isMe: contact.isMe,
        name: contact.name,
        pushname: contact.pushname,
        shortName: contact.shortName,
        number: contact.number,
        isGroup: contact.isGroup,
        isMyContact: contact.isMyContact,
        isWAContact: contact.isWAContact,
    };

}

module.exports = { getContacts };