const { Client, RemoteAuth } = require('./../../../index.js');
const { addClientInitializing, getClientsInitializing, removeClientInitializing } = require('../clients/ClientsInitializingSession');
const { railsAppBaseUrl } = require('./../config/railsAppConfig');

const qrcodeTerminal = require('qrcode-terminal');
const { addClient } = require('./../clients/ClientsConnected');
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
    console.log('railsAppBaseUrl');
    console.log(railsAppBaseUrl);
    console.log('=====================');
    console.log(`Initializing WhatsApp client for ${location_identifier} by user ${user_id}...`);
    addClientInitializing(location_identifier, true);
    
    console.log(`clients initializing: ${JSON.stringify(getClientsInitializing(), null, 2)}`);

    try {
        const client = new Client({
            authStrategy: new RemoteAuth({
                clientId: location_identifier,
                dataPath: './.wwebjs_auth',
                store: store,
                backupSyncIntervalMs: 3 * (60 * 1000) // Optional: Sync interval in milliseconds
            }),
            puppeteer: {
                args: ['--no-sandbox'],
            },
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
        // Send QR code to Rails app instead of logging it
        console.log(`QR code for ${location_identifier}:`, qr);
        console.log('----------------------------------------------------------------------------------------------');
        console.log(`location_identifier: ${location_identifier}, user_id: ${user_id}`);
        console.log('----------------------------------------------------------------------------------------------');
        try {
            console.log('----------------------------------------------------------------------------------------------');
            qrcodeTerminal.generate(qr, { small: true });
            console.log('----------------------------------------------------------------------------------------------');
            console.log('sending qr code to rails app');
            await axios.post(`${railsAppBaseUrl}/qr_code`, {
                code: qr,
                location_identifier: location_identifier,
                user_id: user_id
            });
        } catch (error) {
            console.error(`Failed to send QR code for ${location_identifier}:`, error);
        }
    });

    client.on('remote_session_saved', () => {
        console.log('----------------------------------------------------------------------------------------------');
        console.log('remote_session_saved for session:', location_identifier);
        console.log('----------------------------------------------------------------------------------------------');
    });



    client.on('authenticated', () => {
        // Save the new session data to the database
        console.log('1----------------------------------------------------------------------------------------------');
        console.info('Starting to save session for location:', location_identifier);
        console.info('This can take up to a minute depending on the size of the session data, so please wait.');
        console.log('1----------------------------------------------------------------------------------------------');
    });

    client.on('auth_failure', msg => {
        // Fired if session restore was unsuccessful
        console.log('1----------------------------------------------------------------------------------------------');
        console.error('AUTHENTICATION FAILURE: ', msg);
        console.log('2----------------------------------------------------------------------------------------------');
    });

    client.on('ready', async () => {
        console.log('1----------------------------------------------------------------------------------------------');
        console.log(`WhatsApp client is ready for ${location_identifier}!`);
        removeClientInitializing(location_identifier);
        const client_number = client.info.wid.user;
        const client_platform = client.info.platform;
        const client_pushname = client.info.pushname;
        await axios.post(`${railsAppBaseUrl}/new_login`, {
            event_type: 'success',
            user_id: user_id,
            phone: client_number,
            location_identifier: location_identifier,
            client_platform: client_platform,
            client_pushname: client_pushname
        }).catch(error => {
            console.error('Error sending ready event to rails app:', error);
        });
        console.log('2----------------------------------------------------------------------------------------------');
    });

    // Handle other necessary events like 'message', 'disconnected', etc.
    client.on('message', (message) => {
        processMessage(client, location_identifier, message).catch(error => {
            console.error('Error in processMessage:', error);
        });
    });

    client.on('disconnected', async (reason) => {
        const client_number = client.info.wid.user;
        console.log('1----------------------------------------------------------------------------------------------');
        console.log('Client was logged out: ', reason);
        console.log('2----------------------------------------------------------------------------------------------');
        await axios.post(`${railsAppBaseUrl}/new_login`, {
            event_type: 'logout',
            user_id: user_id,
            phone: client_number,
            location_identifier: location_identifier,
        }).catch(error => {
            console.error('Error sending ready event to rails app:', error);
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
        console.log('1----------------------------------------------------------------------------------------------');
        console.log('Message:', msg);
        console.log('These are the possible values of ack:');
        console.log('ACK_ERROR: -1');
        console.log('ACK_PENDING: 0');
        console.log('ACK_SERVER: 1');
        console.log('ACK_DEVICE: 2');
        console.log('ACK_READ: 3');
        console.log('ACK_PLAYED: 4');
        console.log('Message ack:', ack);
        console.log('2----------------------------------------------------------------------------------------------');
        notifyMessageStatus({ message_serialized_id: msg.id._serialized, message_status: msg.ack });
    });

    process.on('SIGINT', async () => {
        console.log('(SIGINT) Shutting down...');
        await client.destroy();
        // add delay to wait for the client to be destroyed
        setTimeout(() => {
            console.log('after destroying client');
            process.exit(0);
        }, 3000);
        console.log('after destroying client');
        process.exit(0);
    });

    client.on('loading_screen', (percent, message) => {
        console.log('LOADING SCREEN: ', percent, message);
    });
};

async function processMessage(client, location_identifier, message) {
    console.log('1----------------------------------------------------------------------------------------------');
    console.log('These are all the properties of the message object:');
    //printTree(message);
    const client_phone_number = extractNumber(message.from);
    const message_body = message.body;
    console.log('-------------------------------------------------------');
    console.log('Message body: ', message_body);
    console.log('Message from: ', client_phone_number);
    console.log('Message author: ', message.author);
    console.log('Message type: ', message.type);
    console.log('Message deviceType: ', message.deviceType);
    console.log('Message fromMe: ', message.fromMe);
    try {
        const chat = await message.getChat();
        const groupChat = await chat.isGroup;
        console.log('Message is group: ', groupChat);
        if (!groupChat) {
            forwardMessageToRails(client_phone_number, location_identifier, message_body);
        }
    } catch (error) {
        console.error('Error obtaining chat:', error);
    }
    console.log('2----------------------------------------------------------------------------------------------');
}

function forwardMessageToRails(client_phone_number, location_identifier, message_body) {
    console.log('1----------------------------------------------------------------------------------------------');
    console.log('Forwarding message to rails app...');
    console.log('2----------------------------------------------------------------------------------------------');
    axios.post(`${railsAppBaseUrl}/incoming_messages`, {
        client_phone_number: client_phone_number,
        location_identifier: location_identifier,
        message_body: message_body
    }).catch(error => { 
        console.error('Error forwarding message to rails app:', error);
    });
}
function notifyMessageStatus(payload) {
    console.log('1----------------------------------------------------------------------------------------------');
    console.log('Forwarding message to rails app...');
    console.log('2----------------------------------------------------------------------------------------------');
    axios.post(`${railsAppBaseUrl}/message_status`, payload).catch(error => { 
        console.error('Error forwarding message to rails app:', error);
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
