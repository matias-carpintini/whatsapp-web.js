const { ClientModel } = require('./db');
const { railsAppBaseUrl } = require('./../config/railsAppConfig');
const { getClient } = require('./../clients/ClientsConnected');

const axios = require('axios');
const e = require('express');

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

async function checkIdleClients() {
    try {
        return ClientModel.find().then((items) => {
            if (items.length) {
                items.map(async (i) => {
                    console.log(`[checking ... ${i.location_id}] => ${i.status}`)
                    const client = getClient(i.location_id);
                    if (!client){
                        i.updateOne({status: 'disconnected'});
                        axios.post(`${railsAppBaseUrl()}/new_login`, {
                            event_type: 'logout',
                            user_id: 'automatic_reconnect',
                            phone: '000',
                            location_identifier: i.location_id,
                        }).catch(e => {
                            console.error(`${i.location_id} // setup/client.on.disconnected/Error sending ready event to rails app:`, e.code);
                        });
                    } else {
                        if (i.status != 'disconnected'){
                            const pupState = await client.getState().catch(async (error) => {
                                console.log(`${i.location_id} => Error getting client state:`, error);
                            });
                            if (i.status == 'initializing' || i.status == 'qr_code_ready' || i.status == 'authenticated') {
                                if (i.idleCounter && i.idleCounter > 10){
                                    i.updateOne({status: 'idle'})
                                    console.log(`Location [${i.location_id}] now is idle`)
                                    
                                    client.logout().then(() => {
                                        console.log(`${i.location_id} => Client logged out`)

                                        axios.post(`${railsAppBaseUrl()}/new_login`, {
                                            event_type: 'logout',
                                            user_id: 'automatic_reconnect',
                                            phone: '000',
                                            location_identifier: i.location_id,
                                        }).catch(e => {
                                            console.error(`${i.location_id} // setup/client.on.disconnected/Error sending ready event to rails app:`, e.code);
                                        });

                                    }).catch(e => {
                                        console.error(`${i.location_id} => Error logging out:`, e)
                                    }
                                    );
                                } else {
                                    const n = i.idleCounter ? i.idleCounter + 1 : 1;
                                    i.updateOne({ idleCounter: n })
                                }
                            }
                        }
                    }
                })
            }
        })
    } catch (e){
        console.log('[error] in job task: ', e)
    }
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
    console.log(`::: updating: ${location_id} -> ${status}`)
    return (item) ? await item.updateOne(doc) : await ClientModel.create(doc);
}
async function remove(location_id) {
    const doc = { location_id };
    await ClientModel.deleteMany(doc);
}

// DB
const saveDataClient = async (location_identifier, user_id, slug, status='initializing') => {
    await store(location_identifier, user_id, slug, status);
};
const removeDataClient = async (location_identifier, _user_id) => {
    await remove(location_identifier);
    console.log(`::: ${location_identifier} removed from database`);
};

module.exports = { showClients, store, remove, syncClients, checkIdleClients, saveDataClient, removeDataClient }