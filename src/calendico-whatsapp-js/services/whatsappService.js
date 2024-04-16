const { Client, LocalAuth } = require('./../../../index.js');
const { addClientInitializing, removeClientInitializing } = require('../clients/ClientsInitializingSession');
const { railsAppBaseUrl } = require('./../config/railsAppConfig');
const { addQrCodeDelivery, resetQrCodeDelivery, getQrCodeDelivery, incrementQrCodeDeliveryFor, maxQrCodeDeliveriesReached } = require('../clients/qrCodeDeliveries');

const qrcodeTerminal = require('qrcode-terminal');
const { addClient, removeClient, removeDataClient, storeDataClient } = require('./../clients/ClientsConnected');
const { extractNumber } = require('../utils/utilities');
const axios = require('axios');

const initializeWhatsAppClient = async (location_identifier, user_id) => {
    console.log(`Initializing client... ${location_identifier} by user ${user_id}...`);
    addClientInitializing(location_identifier, true);
    
    try {
        const headlessConfig = process.env.CHROMIUM_HEADLESS || true
        console.log(`${location_identifier} // Headless config: ${headlessConfig}`)
        const puppeteerOptions = {
            headless: headlessConfig,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                // other node args
            ]
        };
        if (process.env.CHROMIUM_EXECUTABLE_PATH) {
            console.log(`${location_identifier} Using Chromium from ${process.env.CHROMIUM_EXECUTABLE_PATH}`)
            puppeteerOptions.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
        }
        
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: location_identifier,
                dataPath: process.env.AUTH_PATH || './.wwebjs_auth'
            }),
            puppeteer: puppeteerOptions,
            authTimeoutMs: 30000,
            location_identifier: location_identifier
        });

        // Setup event listeners for the client
        setupClientEventListeners(client, location_identifier, user_id);

        // Initialize the client
        client.initialize();

        // Store the client instance in the clients object
        addClient(location_identifier, client);
        storeDataClient(location_identifier, user_id);

    } catch (error) {
        console.error(`${location_identifier} Failed to initialize WhatsApp client. Error: `, error);
    }
};

const setupClientEventListeners = (client, location_identifier, user_id) => {
    client.on('qr', async (qr) => {
        incrementQrCodeDelivery(location_identifier);
        if (maxQrCodeDeliveriesReached(location_identifier)) {
            console.log(`${location_identifier} :::client.on.qr/Max QR code deliveries reached`);
            resetQrCodeDelivery(location_identifier);
            removeClientInitializing(location_identifier);
            await notifyMaxQrCodesReached(location_identifier);
            client.destroy();
            removeClient(location_identifier);
            // removeDataClient(location_identifier);
            return;
        }
        // Send QR code to Rails app instead of logging it
        //console.log(`/setup/client.on.qr/QR generated code for ${location_identifier}:`, qr);
        console.log(`${location_identifier}/setup/client.on.qr, user_id: ${user_id}`);
        try {
            qrcodeTerminal.generate(qr, { small: true });
            const qrcodeUrl = process.env.RAILS_APP_URL || 'http://localhost:3000';
            await axios.post(`${qrcodeUrl}/whatsapp_web/qr_code`, {
                code: qr,
                location_identifier: location_identifier,
                user_id: user_id
            });
        } catch (error) {
            console.error(`${location_identifier} Failed to send QR to Rails. CODE: ${error.code}`);
        }
    });

    client.on('remote_session_saved', () => {
        console.log(`${location_identifier} //setup/client.on.remote_session_saved.`);
    });

    client.on('authenticated', () => {
        // Save the new session data to the database
        console.info(`${location_identifier} //setup/client.on.authenticated/This can take up to a minute depending on the size of the session data, so please wait.`);
    });

    client.on('auth_failure', msg => {
        // Fired if session restore was unsuccessful
        console.error(`${location_identifier} //setup/client.on.auth_failure/AUTHENTICATION FAILURE: `, msg);
    });

    client.on('ready', async () => {
        console.log(`${location_identifier} //setup/client.on.ready`);
        removeClientInitializing(location_identifier);
        const client_number = client.info.wid.user;
        const client_platform = client.info.platform;
        const client_pushname = client.info.pushname;
        await axios.post(`${railsAppBaseUrl()}/new_login`, {
            event_type: 'success',
            user_id: user_id,
            phone: client_number,
            location_identifier: location_identifier,
            client_platform: client_platform,
            client_pushname: client_pushname
        }).catch(error => {
            console.error(`${location_identifier} // setup/client.on.ready/Error sending ready event to rails app:`, error);
        });
    });

    // Handle other necessary events like 'message', 'disconnected', etc.
    client.on('message', (message) => {
        processMessage(client, location_identifier, message).catch(error => {
            console.error(`${location_identifier} // setup/client.on.message/Error in processMessage:`, error);
        });
    });

    client.on('disconnected', async (reason) => {
        let client_number = '000';
        try {
            client_number = client.info.wid.user;
        } catch (e){
            console.log('error: client number issue, no WID', location_identifier)
        }
        console.log(`${location_identifier} // /setup/client.on.disconnected/loc: (${location_identifier}) was logged out: `, reason);
        removeDataClient(location_identifier);
        // TO DO => NAVIGATION reason to could be first time to reinitialize. 
        await axios.post(`${railsAppBaseUrl()}/new_login`, {
            event_type: 'logout',
            user_id: user_id,
            phone: client_number,
            location_identifier: location_identifier,
        }).catch(error => {
            console.error(`${location_identifier} // setup/client.on.disconnected/Error sending ready event to rails app:`, error);
        });
    });

    client.on('message_ack', (msg, ack) => {
        /*
            == ACK VALUES ==
            ACK_ERROR: -1
            ACK_PENDING: 0
            ACK_SERVER: 1
            ACK_DEVICE: 2
            ACK_READ: 3
            ACK_PLAYED: 4
        */
        notifyMessageStatus({ message_serialized_id: msg.id._serialized, message_status: msg.ack });
    });

    process.on('SIGINT', async () => {
        console.log(`${location_identifier} // (SIGINT) Shutting down...`);
        await client.destroy();
        // add delay to wait for the client to be destroyed
        setTimeout(() => {
            console.log(`${location_identifier} // (SIGINT)timeout done, after destroying client`);
            process.exit(0);
        }, 3000);
        console.log(`${location_identifier} // (SIGINT) after destroying client`);
        process.exit(0);
    });

    client.on('change_state', (state) => {
        console.log(`${location_identifier} // STATE_CHANGE`, state)
    })
    client.on('loading_screen', (percent, message) => {
        console.log(`${location_identifier} // client.on.loading_screen/LOADING SCREEN: `, percent, message);
    });
};

const incrementQrCodeDelivery = (location_identifier) => {
    const qrCodeDelivery = getQrCodeDelivery(location_identifier);
    if (qrCodeDelivery) {
        incrementQrCodeDeliveryFor(location_identifier);
    } else {
        addQrCodeDelivery(location_identifier);
    }
}

async function processMessage(client, location_identifier, message) {
    //console.log('processMessage/These are all the properties of the message object:');
    //printTree(message);
    const client_phone_number = extractNumber(message.from);
    const message_body = message.body;
    if (client_phone_number != 'status'){
        // received message.
        // console.log(`CLIENT[${client_phone_number}] BODY[${message_body}] AUTHOR[${message.author}] DEVICETYPE[${message.deviceType}] FROM_ME?[${message.fromMe}]`);
    }
    try {
        const chat = await message.getChat();
        const groupChat = await chat.isGroup;
        //console.log('processMessage/Message is group: ', groupChat);
        if (!groupChat) {
            forwardMessageToRails(client_phone_number, location_identifier, message_body);
        }
    } catch (error) {
        console.error(`${location_identifier} // processMessage/Error obtaining chat:`, error);
    }
}

function forwardMessageToRails(client_phone_number, location_identifier, message_body) {
    //console.log('forwardMessageToRails/[forwardMessageToRails] Forwarding message to rails app...');
    axios.post(`${railsAppBaseUrl()}/incoming_messages`, {
        client_phone_number: client_phone_number,
        location_identifier: location_identifier,
        message_body: message_body
    }).catch(error => { 
        console.error(`${location_identifier} // forwardMessageToRails/Error forwarding message to rails app:`, error);
    });
}

function notifyMessageStatus(payload) {
    //console.log('notifyMessageStatus/Forwarding message to rails app...');
    axios.post(`${railsAppBaseUrl()}/message_status`, payload).catch(error => { 
        console.error(`${location_identifier} // notifyMessageStatus/Error forwarding message to rails app:`, error);
    });
}

async function notifyMaxQrCodesReached(location_identifier) {
    console.log(`${location_identifier} // notifyMaxQrCodesReached/Notifying rails app of max QR codes reached...`)
    await axios.post(`${railsAppBaseUrl()}/new_login`, {
        event_type: 'max_qr_codes_reached',
        location_identifier: location_identifier,
    }).catch(error => {
        console.error('notifyMaxQrCodesReached/Error in rails::new_login CODE:', error.code);
    });
}

function printTree(obj, depth = 0) {
    const indent = '_'.repeat(depth * 4); // Increase indent for each level of depth
    Object.keys(obj).forEach(key => {
        const value = obj[key];

        // Check if value is an object and not null, and recursively call printTree
        if (typeof value === 'object' && value !== null) {
            console.log(`| ${indent}${key}:`);
            printTree(value, depth + 1);
        } else {
            console.log(`| ${indent}${key}: ${value}`);
        }
    });
}

module.exports = { initializeWhatsAppClient };
