const { getClient } = require('./../clients/ClientsConnected');
const { extractNumber } = require('../utils/utilities');
const {getClientInitializing} = require('../clients/ClientsInitializingSession');

async function getChats(location_identifier, chats_to_get, res, return_raw_chats = false) {
    if (!location_identifier) {
        return res.status(400).json({success: false, message: 'The location identifier is required'});
    }

    try {
        const client = getClient(location_identifier);
        if (!client) {
            if (getClientInitializing(location_identifier)) {
                console.log('============================================');
                console.log('Client is initializing...');
                console.log('============================================');
                return res.status(400).json({
                    success: false,
                    message: 'Client is already initializing. Please try again in a few seconds.'
                });
            }
            return res.status(400).json({success: false, message: `There is no client with this location_identifier: ${location_identifier}`});
        }
        else {
            const chats = await client.getChats();
            if (return_raw_chats) {
                return chats;
            }
            console.log('============================================');
            console.log(`There are ${chats.length} chats`);
            createChatJSONObject(chats, Number(chats_to_get))
                .then(chatJSONObject => {
                    console.log(JSON.stringify(chatJSONObject, null, 2));
                    return res.status(200).json({code: 200, status: 'success', body: chatJSONObject});
                })
                .catch(error => {
                    console.error('Error creating chat JSON object:', error);
                    res.status(500).json({success: false, message: `Error creating chat JSON object: ${error}`});
                });
        }
    } catch (error) {
        console.error('Error in getChats process:', error);
        res.status(500).json({success: false, message: 'Error during getChats process'});
    }
}

function createChatJSONObject(chats, chats_to_get) {
    return Promise.all(chats.map(chat => {
        return chat.fetchMessages({limit: Number(chats_to_get)})
            .then(messages => {
                return {
                    chatName: chat.name,
                    groupChat: chat.isGroup,
                    messages: messages.map(message => {
                        return {
                            from: extractNumber(message.from),
                            fromMe: message.fromMe,
                            body: message.body
                        };
                    })
                };
            });
    }))
        .then(chatsWithMessages => {
            let chatJSONObject = {};
            chatsWithMessages.forEach(chat => {
                chatJSONObject[chat.chatName] = {groupChat: chat.groupChat, messages: chat.messages};
            });
            return chatJSONObject;
        });
}

module.exports = { getChats };