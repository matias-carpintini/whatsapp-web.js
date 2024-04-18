const {getChats} = require('./getChats');

async function getContacts(location_identifier, res) {
    if (!location_identifier) {
        return res.status(400).json({ success: false, message: 'getContacts/The location identifier is required' });
    }

    try {
        const chats = await getChats(location_identifier, 1, res, true);
        let contacts = [];
        if (chats === false) {
            console.log('getContacts/We cannot get the contacts at this moment');
            return res.status(400).json({ success: false, message: 'We cannot get the contacts at this moment. Please try again later' });
        } 
        for (const chat of chats) {
            const contact = await chat.getContact();
            const contact_info = contactPresenter(contact);
            contacts.push(contact_info);
        }

        console.log('getContacts/Contacts array size:'. contacts.length);
        return res.status(200).json({ code: 200, status: 'success', body: contacts });
    } catch (error) {
        console.error('getContacts/Error in getContacts process:', error);
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