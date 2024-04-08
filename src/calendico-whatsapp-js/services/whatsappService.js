const { Client, RemoteAuth } = require('./../../../index.js');
const { addClientInitializing, getClientsInitializing, removeClientInitializing } = require('../clients/ClientsInitializingSession');
const { railsAppBaseUrl } = require('./../config/railsAppConfig');
const { getQrCodeDeliveries, addQrCodeDelivery, resetQrCodeDelivery, getQrCodeDelivery, incrementQrCodeDeliveryFor, maxQrCodeDeliveriesReached } = require('../clients/qrCodeDeliveries');

const qrcodeTerminal = require('qrcode-terminal');
const { addClient, removeClient } = require('./../clients/ClientsConnected');
const { extractNumber } = require('../utils/utilities');
const axios = require('axios');
const { AwsS3Store } = require('wwebjs-aws-s3');
const {
    S3Client,
    PutObjectCommand,
    HeadObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
} = require('@aws-sdk/client-s3');

const s3 = new S3Client({
    region: process.env.AWS_S3_REGION,
    credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCES_KEY_ID
    }
});

const putObjectCommand = PutObjectCommand;
const headObjectCommand = HeadObjectCommand;
const getObjectCommand = GetObjectCommand;
const deleteObjectCommand = DeleteObjectCommand;

const store = new AwsS3Store({
    bucketName: process.env.AWS_S3_BUCKET_NAME,
    remoteDataPath: process.env.AWS_S3_FOLDER_NAME,
    s3Client: s3,
    putObjectCommand,
    headObjectCommand,
    getObjectCommand,
    deleteObjectCommand
});


const initializeWhatsAppClient = async (location_identifier, user_id) => {
    console.log('=====================');
    console.log(`railsAppBaseUrl: ${railsAppBaseUrl()}`);
    console.log('=====================');
    console.log(`Initializing WhatsApp client for ${location_identifier} by user ${user_id}...`);

    addClientInitializing(location_identifier, true);
    
    console.log(`WAService => clients initializing: ${JSON.stringify(getClientsInitializing(), null, 2)}`);

    try {
        const puppeteerOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                // other node args
            ]
        };
        if (process.env.CHROMIUM_EXECUTABLE_PATH) {
            console.log('Using Chromium from', process.env.CHROMIUM_EXECUTABLE_PATH)
            puppeteerOptions.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
        }
        
        const client = new Client({
            authStrategy: new RemoteAuth({
                clientId: location_identifier,
                dataPath: './.wwebjs_auth',
                store: store,
                backupSyncIntervalMs: 60 * (60 * 1000) // Optional: Sync interval in milliseconds
            }),
            //restartOnAuthFail: true, // optional
            puppeteer: puppeteerOptions,
        });

        // Setup event listeners for the client
        setupClientEventListeners(client, location_identifier, user_id);

        // Initialize the client
        client.initialize();

        // Store the client instance in the clients object
        addClient(location_identifier, client);

    } catch (error) {
        console.error(`Failed to initialize WhatsApp client for ${location_identifier}:`, error);
    }
};

const setupClientEventListeners = (client, location_identifier, user_id) => {
    client.on('qr', async (qr) => {
        incrementQrCodeDelivery(location_identifier);
        if (maxQrCodeDeliveriesReached(location_identifier)) {
            console.log('client.on.qr/Max QR code deliveries reached for location: ', location_identifier);
            resetQrCodeDelivery(location_identifier);
            removeClientInitializing(location_identifier);
            await notifyMaxQrCodesReached(location_identifier);
            client.destroy();
            removeClient(location_identifier);
            return;
        }
        // Send QR code to Rails app instead of logging it
        console.log(`/setup/client.on.qr/QR generate code for ${location_identifier}:`, qr);
        console.log(`/setup/client.on.qr/location_identifier: ${location_identifier}, user_id: ${user_id}`);
        try {
            qrcodeTerminal.generate(qr, { small: true });
            console.log('sending qr code to rails app');
            const qrcodeUrl = process.env.RAILS_APP_URL || 'http://localhost:3000';
            await axios.post(`${qrcodeUrl}/whatsapp_web/qr_code`, {
                code: qr,
                location_identifier: location_identifier,
                user_id: user_id
            });
        } catch (error) {
            console.error(`Failed to send QR code for ${location_identifier}:`, error);
        }
    });

    client.on('remote_session_saved', () => {
        console.log('/setup/client.on.remote_session_saved for session:', location_identifier);
    });



    client.on('authenticated', () => {
        // Save the new session data to the database
        console.info('/setup/client.on.authenticated/Starting to save session for location:', location_identifier);
        console.info('/setup/client.on.authenticated/This can take up to a minute depending on the size of the session data, so please wait.');
    });

    client.on('auth_failure', msg => {
        // Fired if session restore was unsuccessful
        console.error('/setup/client.on.auth_failure/AUTHENTICATION FAILURE: ', msg);
    });

    client.on('ready', async () => {
        console.log(`/setup/client.on.ready/Client ready for ${location_identifier}!`);
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
            console.error('/setup/client.on.ready/Error sending ready event to rails app:', error);
        });
    });

    // Handle other necessary events like 'message', 'disconnected', etc.
    client.on('message', (message) => {
        console.log(`/setup/client.on.message for location: ${location_identifier} msg: ${message.body}`)
        processMessage(client, location_identifier, message).catch(error => {
            console.error('/setup/client.on.message/Error in processMessage:', error);
        });
    });

    client.on('disconnected', async (reason) => {
        const client_number = client.info.wid.user;
        console.log(`/setup/client.on.disconnected/loc: (${location_identifier}) was logged out: `, reason);
        await axios.post(`${railsAppBaseUrl()}/new_login`, {
            event_type: 'logout',
            user_id: user_id,
            phone: client_number,
            location_identifier: location_identifier,
        }).catch(error => {
            console.error('/setup/client.on.disconnected/Error sending ready event to rails app:', error);
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
        console.log('(SIGINT) Shutting down...');
        await client.destroy();
        // add delay to wait for the client to be destroyed
        setTimeout(() => {
            console.log('(SIGINT)timeout done, after destroying client');
            process.exit(0);
        }, 3000);
        console.log('(SIGINT) after destroying client');
        process.exit(0);
    });

    client.on('loading_screen', (percent, message) => {
        console.log('client.on.loading_screen/LOADING SCREEN: ', percent, message);
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
    console.log('processMessage/These are all the properties of the message object:');
    //printTree(message);
    const client_phone_number = extractNumber(message.from);
    const message_body = message.body;
    console.log('Message body: ', message_body);
    console.log('Message from: ', client_phone_number);
    console.log('Message author: ', message.author);
    console.log('Message type: ', message.type);
    console.log('Message deviceType: ', message.deviceType);
    console.log('Message fromMe: ', message.fromMe);
    try {
        const chat = await message.getChat();
        const groupChat = await chat.isGroup;
        console.log('processMessage/Message is group: ', groupChat);
        if (!groupChat) {
            forwardMessageToRails(client_phone_number, location_identifier, message_body);
        }
    } catch (error) {
        console.error('processMessage/Error obtaining chat:', error);
    }
}

function forwardMessageToRails(client_phone_number, location_identifier, message_body) {
    console.log('forwardMessageToRails/[forwardMessageToRails] Forwarding message to rails app...');
    axios.post(`${railsAppBaseUrl()}/incoming_messages`, {
        client_phone_number: client_phone_number,
        location_identifier: location_identifier,
        message_body: message_body
    }).catch(error => { 
        console.error('forwardMessageToRails/Error forwarding message to rails app:', error);
    });
}

function notifyMessageStatus(payload) {
    console.log('notifyMessageStatus/Forwarding message to rails app...');
    axios.post(`${railsAppBaseUrl()}/message_status`, payload).catch(error => { 
        console.error('notifyMessageStatus/Error forwarding message to rails app:', error);
    });
}

async function notifyMaxQrCodesReached(location_identifier) {
    await axios.post(`${railsAppBaseUrl()}/new_login`, {
        event_type: 'max_qr_codes_reached',
        location_identifier: location_identifier,
    }).catch(error => {
        console.error('notifyMaxQrCodesReached/Error sending ready event to rails app:', error);
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
