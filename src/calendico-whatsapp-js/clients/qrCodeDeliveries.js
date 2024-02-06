// Fake database to store qrCode deliveries
// Each record will be a key-value pair where the key is the location identifier and the value is number of times the qrCode was delivered
// Shared qrCode deliveries object
const qrCodeDeliveries = {};
const MAX_QR_CODE_DELIVERIES = 6;

// Functions to manipulate qrCode deliveries
const getQrCodeDeliveries = () => qrCodeDeliveries;

const maxQrCodeDeliveriesReached = (location_identifier) => {
    return qrCodeDeliveries[location_identifier] >= MAX_QR_CODE_DELIVERIES;
}
const addQrCodeDelivery = (location_identifier) => {
    qrCodeDeliveries[location_identifier] = 1;
};

const getQrCodeDelivery = (location_identifier) => qrCodeDeliveries[location_identifier];

const resetQrCodeDelivery = (location_identifier) => {
    if (qrCodeDeliveries[location_identifier]) {
        delete qrCodeDeliveries[location_identifier];
        console.log(`Resetting qrCode deliveries for location identifier: ${location_identifier}`);
    } else {
        console.log(`No qrCode deliveries found for location identifier: ${location_identifier}`);
    }
};

const incrementQrCodeDeliveryFor = (location_identifier) => {
    qrCodeDeliveries[location_identifier] = qrCodeDeliveries[location_identifier] + 1;
}

module.exports = { getQrCodeDeliveries, addQrCodeDelivery, resetQrCodeDelivery, getQrCodeDelivery, incrementQrCodeDeliveryFor, maxQrCodeDeliveriesReached };
