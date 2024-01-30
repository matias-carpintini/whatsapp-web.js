// Add the uri for the rails app
const railsAppBaseUrl = () => {
    const uri = process.env.RAILS_APP_URL || 'http://localhost:3000';
    const endpointScope = process.env.RAILS_APP_ENDPOINT_SCOPE || '/whatsapp_js';
    const baseUrl =  (uri + endpointScope);
    return baseUrl;
};

module.exports = { railsAppBaseUrl };