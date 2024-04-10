// Shared clients object
const clientsInitializing = {};

// Functions to manipulate clients
const getClientsInitializing = () => clientsInitializing;

const addClientInitializing = (location_identifier, clientInstance) => {
    clientsInitializing[location_identifier] = clientInstance;
};

const getClientInitializing = (location_identifier) => clientsInitializing[location_identifier];

const removeClientInitializing = (location_identifier) => {
    if (clientsInitializing[location_identifier]) {
        delete clientsInitializing[location_identifier];
        console.log(`removeClientInitializing/Initializing client removed for location identifier: ${location_identifier}`);
    } else {
        console.log(`removeClientInitializing/No client found for location identifier: ${location_identifier}`);
    }
};

module.exports = { getClientsInitializing, addClientInitializing, removeClientInitializing, getClientInitializing };
