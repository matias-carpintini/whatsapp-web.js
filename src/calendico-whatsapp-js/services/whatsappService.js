const Util = require('../../util/Util');
const { Client, LocalAuth } = require('./../../../index.js');
const { addClientInitializing, removeClientInitializing } = require('../clients/ClientsInitializingSession');
const { railsAppBaseUrl } = require('./../config/railsAppConfig');
const { addQrCodeDelivery, resetQrCodeDelivery, getQrCodeDelivery, incrementQrCodeDeliveryFor, maxQrCodeDeliveriesReached } = require('../clients/qrCodeDeliveries');
const { addClient, removeClient } = require('./../clients/ClientsConnected'); 
const { saveDataClient, removeDataClient } = require('./../services/client'); 
const qrcodeTerminal = require('qrcode-terminal');
const axios = require('axios');

const initializeWhatsAppClient = async (location_identifier, user_id, slug = null) => {
    try {
        console.log(`Initializing client... ${location_identifier} by user ${user_id}...`);
        addClientInitializing(location_identifier, true); 
        // In this case. We're creating a pupclient. But still clients[] is empty and saveDataClient is not called.
        const headlessConfig = process.env.CHROMIUM_HEADLESS || true
        console.log(`${location_identifier} // Headless config: ${headlessConfig}`)
        const puppeteerOptions = {
            headless: headlessConfig,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ]
        };
        if (process.env.CHROMIUM_EXECUTABLE_PATH) {
            console.log(`${location_identifier} Using Chromium from ${process.env.CHROMIUM_EXECUTABLE_PATH}`)
            puppeteerOptions.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
        }
        console.log("executablePath: ", puppeteerOptions.executablePath)
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: location_identifier,
                dataPath: process.env.AUTH_PATH || './.wwebjs_auth'
            }),
            puppeteer: puppeteerOptions,
            authTimeoutMs: 0,
            location_identifier: location_identifier
        });
        setupClientEventListeners(client, location_identifier, user_id);
        client.initialize();
        addClient(location_identifier, client);
        saveDataClient(location_identifier, user_id, slug, 'initializing', true);
    } catch (e) {
        // TODO -> what to do in DB ?
        console.error(`${location_identifier} Failed to initialize WhatsApp client. Error: `, Util.prettifyError(e));
    }
};

const setupClientEventListeners = (client, location_identifier, user_id) => {
    client.on('qr', async (qr) => {
        incrementQrCodeDelivery(location_identifier);
        if (maxQrCodeDeliveriesReached(location_identifier)) {
            console.log(`${location_identifier} :::client.on.qr/Max QR code deliveries reached`);
            saveDataClient(location_identifier, user_id, null, 'disconnected'); 
            resetQrCodeDelivery(location_identifier);
            removeClientInitializing(location_identifier);
            try {
            await notifyMaxQrCodesReached(location_identifier);
            } catch (e){}
            try {
                client.logout();
                client.destroy();
                removeClient(location_identifier); 
            } catch (e){
                console.error(`${location_identifier} :::client.on.qr/Error logging out client:`, Util.prettifyError(e));
            }
            return;
        }
        console.log(`Sending to rails: ${location_identifier}/setup/client.on.qr, user_id: ${user_id}`);
        try {
            saveDataClient(location_identifier, null, null, 'qr_code_ready');
            /*if (user_id == 'automatic_reconnect'){
                // nobody is asking for the QR.
                console.log('QR was generated automatically, no need to send to rails')
            } else { */
                qrcodeTerminal.generate(qr, { small: true });
                const qrcodeUrl = process.env.RAILS_APP_URL || 'http://localhost:3000';
                await axios.post(`${qrcodeUrl}/whatsapp_web/qr_code`, {
                    code: qr,
                    location_identifier: location_identifier,
                    user_id: user_id
                });
            //}
        } catch (error) {
            console.error(`${location_identifier} Failed to send QR to Rails. CODE: ${error.code}`);
        }
    });

    client.on('remote_session_saved', () => {
        console.log(`${location_identifier} //setup/client.on.remote_session_saved.`);
    });

    client.on('authenticated', () => {
        // Save the new session data to the database
        saveDataClient(location_identifier, user_id, null, 'authenticated');
        console.info(`${location_identifier} //setup/client.on.authenticated/This can take up to a minute depending on the size of the session data, so please wait.`);
    });

    client.on('auth_failure', msg => {
        // Fired if session restore was unsuccessful
        saveDataClient(location_identifier, user_id, null, 'auth_failure');
        console.error(`${location_identifier} //setup/client.on.auth_failure/AUTHENTICATION FAILURE: `, msg);
    });

    client.on('ready', async () => {
        console.log(`${location_identifier} //setup/client.on.ready`);
        removeClientInitializing(location_identifier);
        saveDataClient(location_identifier, user_id, null, 'connected');
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
        }).catch(e => {
            console.error(`${location_identifier} // setup/client.on.ready/Error sending ready event to rails app:`, Util.prettifyError(e));
        });
    });

    // Handle other necessary events like 'message', 'disconnected', etc.
    client.on('message', (message) => {
        processMessage(client, location_identifier, message).catch(e => {
            console.error(`${location_identifier} // setup/client.on.message/Error in processMessage:`, Util.prettifyError(e));
        });
    });

    client.on('disconnected', async (reason) => {
        let client_number = '000';
        try {
            client_number = client.info.wid.user;
        } catch (e){
            console.log('error: client number issue, no WID', location_identifier)
        }
        console.log(`${location_identifier} // setup/client.on.disconnected/loc: (${location_identifier}) was logged out: `, reason);
        removeClient(location_identifier);
        removeDataClient(location_identifier);
        // TO DO => NAVIGATION reason to could be first time to reinitialize. 
        await axios.post(`${railsAppBaseUrl()}/new_login`, {
            event_type: 'logout',
            user_id: user_id,
            phone: client_number,
            location_identifier: location_identifier,
        }).catch(e => {
            console.error(`${location_identifier} // setup/client.on.disconnected/Error sending ready event to rails app:`, Util.prettifyError(e));
        });
    });

//    client.on('message_ack', (msg, ack) => {
        /*
            == ACK VALUES ==
            ACK_ERROR: -1
            ACK_PENDING: 0
            ACK_SERVER: 1
            ACK_DEVICE: 2
            ACK_READ: 3
            ACK_PLAYED: 4
        */
        // ASK: is it useful ? for the moment no.
        // notifyMessageStatus({ message_serialized_id: msg.id._serialized, message_status: msg.ack });
 //   });

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
        saveDataClient(location_identifier, user_id, null, 'loading_screen');
        console.log(`${location_identifier} // client.on.loading_screen`, percent, message);
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
    try {
        const client_phone_number = Util.extractNumber(message.from);
        if (!client_phone_number || !client_phone_number.length || client_phone_number == 'status') {
            return true;
        }
        const message_body = message.body;
        /* 
        if (client_phone_number != 'status') { // logging chat
            console.log(`CLIENT[${client_phone_number}] BODY[${message_body}] AUTHOR[${message.author}] DEVICETYPE[${message.deviceType}] FROM_ME?[${message.fromMe}]`);
        } */
        const chat = await message.getChat();
        const groupChat = await chat.isGroup;
        //console.log('processMessage/Message is group: ', groupChat);
        if (!groupChat) {
            forwardMessageToRails(client_phone_number, location_identifier, message_body);
        }
    } catch (e) {
        console.error(`${location_identifier} // processMessage/Error obtaining chat: `, Util.prettifyError(e));
    }
}

function forwardMessageToRails(client_phone_number, location_identifier, message_body) {
    try {
        saveDataClient(location_identifier, null, null, 'process_message');
        axios.post(`${railsAppBaseUrl()}/incoming_messages`, {
            client_phone_number: client_phone_number,
            location_identifier: location_identifier,
            message_body: message_body
        }).catch(e => { 
            console.error(`${location_identifier} // forwardMessageToRails/Error forwarding message to rails app:`, Util.prettifyError(e));
        });
    } catch (e){
        console.log(`${location_identifier} // [error] forwarding message to rails app: `, Util.prettifyError(e))
    }
}
async function notifyMaxQrCodesReached(location_identifier) {
    console.log(`${location_identifier} // notifyMaxQrCodesReached/Notifying rails app of max QR codes reached...`)
    saveDataClient(location_identifier, null, null, 'maxQrCodesReached');
    await axios.post(`${railsAppBaseUrl()}/new_login`, {
        event_type: 'max_qr_codes_reached',
        location_identifier: location_identifier,
    }).catch(e => {
        console.error('notifyMaxQrCodesReached/Error in rails::new_login CODE:', e.code);
    });
}

/*
function notifyMessageStatus(payload) {
    try {
        axios.post(`${railsAppBaseUrl()}/message_status`, payload).catch(error => { 
            console.error(`${location_identifier} // notifyMessageStatus/Error forwarding message to rails app:`, Util.prettifyError(e));
        });
    } catch (e){
        console.log(`${location_identifier} // [error] forwarding statusMessage to rails app: `, Util.prettifyError(e))
    }
}
*/
module.exports = { initializeWhatsAppClient };
