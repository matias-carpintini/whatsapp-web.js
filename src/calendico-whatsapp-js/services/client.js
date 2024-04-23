const { ClientModel } = require('./db');
const { railsAppBaseUrl } = require('./../config/railsAppConfig');
const Util = require('../../util/Util');

const axios = require('axios');

async function syncClients(status = 'active') {
    return ClientModel.find().then((items) => {
        if (items.length)
            items.map((i) => {
                console.log(`Sync Location [${i.location_id}] is ${i.status}`)
                axios.post(`${railsAppBaseUrl()}/sync_process`, {
                    event_type: 'check_status',
                    location_identifier: i.location_id
                })
                .then(response => {
                    console.log(`${i.location_id} // sync_process response:`, response.data);
                })
                .catch(e => {
                    console.error(`${i.location_id} // sync_process failed:`, e.code);
                });
            }
        )
    })
}
function showClients(status = 'active') {
    const items = ClientModel.find().then((items) => {
        if (items.length)
            console.log(items.map((i) => `Location [${i.location_id}] is ${i.status}`))
    })
    return items;
}
async function store(location_id, user_id, slug, status='initializing') {
    let doc = { location_id, status, last_activity: Date.now() };
    if (user_id) doc.user_id = user_id; // optional
    if (slug) doc.slug = slug; // optional
    let item = await ClientModel.findOne({location_id});
    if (item) console.log('::: db record exists')
    console.log('::: updating: ', doc)
    return (item) ? await item.updateOne(doc) : await ClientModel.create(doc);
}
async function remove(location_id) {
    const doc = { location_id };
    await ClientModel.deleteMany(doc);
}

module.exports = { showClients, store, remove, syncClients }