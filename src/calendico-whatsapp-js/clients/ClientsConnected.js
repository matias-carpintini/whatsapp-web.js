const clients = {};

// memory
const getClients = () => clients;
const addClient = (location_identifier, clientInstance) => {
    clients[location_identifier] = clientInstance; 
};
const getClient = (location_identifier) => {
    if (typeof clients[location_identifier] === undefined) {
        console.error(`getClient/logging clientid arr is undefined.`);
    }
    return clients[location_identifier];
};
const removeClient = (location_identifier) => {
    if (clients[location_identifier]) {
        delete clients[location_identifier];
        console.log(`removeClient/Client removed for location identifier: ${location_identifier}`);
    } else {
        console.log(`removeClient/No client found for location identifier: ${location_identifier}`);
    }
};

module.exports = { getClients, addClient, removeClient, getClient };
