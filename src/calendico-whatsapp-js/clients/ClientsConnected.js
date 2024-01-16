// Shared clients object
const clients = {};

// Functions to manipulate clients
const getClients = () => clients;

const addClient = (location_identifier, clientInstance) => {
    clients[location_identifier] = clientInstance;
};

const getClient = (location_identifier) => clients[location_identifier];

const removeClient = (location_identifier) => {
    if (clients[location_identifier]) {
        delete clients[location_identifier];
        console.log(`Client removed for location identifier: ${location_identifier}`);
    } else {
        console.log(`No client found for location identifier: ${location_identifier}`);
    }
};

module.exports = { getClients, addClient, removeClient, getClient };
