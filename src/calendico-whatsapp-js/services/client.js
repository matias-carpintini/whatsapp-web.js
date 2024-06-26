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
                        if (i.status != 'disconnected'){
                            i.status = 'disconnected'; i.idleCounter = 0;
                            i.save();
                            console.log(`Client browser is not in memory. Moving ${i.location_id} to disconnected and posting to Rails`)
                            axios.post(`${railsAppBaseUrl()}/new_login`, {
                                event_type: 'logout',
                                user_id: 'automatic_reconnect',
                                phone: '000',
                                location_identifier: i.location_id,
                            }).catch(e => {
                                console.error(`${i.location_id} // error sending logout event to rails app:`, e.code);
                            });
                        } else {

                        }
                    } else {
                        if (i.status != 'disconnected'){
                            const pupState = await client.getState().catch(async (error) => {
                                console.log(`${i.location_id} => Error getting client state:`, error);
                            });
                            if (i.status == 'initializing' || i.status == 'qr_code_ready' || i.status == 'authenticated' || i.status == 'maxQrCodesReached') {
                                console.log('checking idleCounter', i.idleCounter)
                                if (i.idleCounter && i.idleCounter > 10){
                                    i.status = 'disconnected'; i.idleCounter = 0;
                                    i.save();
                                    console.log(`Location [${i.location_id}] now is idle`)
                                    
                                    client.logout().then(() => {
                                        console.log(`${i.location_id} => Client logged out`)
                                        
                                        axios.post(`${railsAppBaseUrl()}/new_login`, {
                                            event_type: 'logout',
                                            user_id: 'automatic_reconnect',
                                            phone: '000',
                                            location_identifier: i.location_id,
                                        }).catch(e => {
                                            console.error(`${i.location_id} // error sending logout event to rails app:`, e.code);
                                        });
                                        
                                    }).catch(e => {
                                        console.error(`${i.location_id} => Error logging out:`, e)
                                    }
                                );
                            } else {
                                const n = i.idleCounter ? i.idleCounter + 1 : 1;
                                console.log('incrementing counter...', n)
                                    i.idleCounter = n;
                                    i.save();
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

async function syncDisconnected() {
    try {
        return ClientModel.find({status: 'disconnected'}).then((items) => {
            if (items.length) {
                items.map(async (i) => {
                    console.log(`[sync::Sending status rails ... ${i.location_id}] => ${i.status}`)
                    axios.post(`${railsAppBaseUrl()}/new_login`, {
                        event_type: 'logout',
                        user_id: 'automatic_reconnect',
                        phone: '000',
                        location_identifier: i.location_id,
                    }).catch(e => {
                        console.error(`${i.location_id} // error sending logout event to rails app:`, e.code);
                    }); 
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
    if (status == 'connected' || status=='process_message' || status == 'disconnected'){
        doc.idleCounter = 0;
    }
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

module.exports = { showClients, store, remove, syncClients, checkIdleClients, saveDataClient, removeDataClient, syncDisconnected }