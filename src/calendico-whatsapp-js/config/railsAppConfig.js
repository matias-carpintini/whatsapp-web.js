// Add the uri for the rails app
const railsAppBaseUrl = () => {
    const uri = process.env.RAILS_APP_URL || 'http://localhost:';
    const port =  process.env.RAILS_APP_PORT || '3000';
    const endpointScope = process.env.RAILS_APP_ENDPOINT_SCOPE || '/whatsapp_js';
    const baseUrl =  (uri + port + endpointScope);
    return baseUrl;
};

module.exports = { railsAppBaseUrl };