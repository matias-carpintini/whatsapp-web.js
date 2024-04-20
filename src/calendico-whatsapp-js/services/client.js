const { ClientModel } = require('./db');

function showClients(status = 'active') {
    const items = ClientModel.find().then((items) => {
        if (items.length)
            console.log(items.map((i) => `Location [${i.location_id}] is ${i.status}`))
    })
    return items;
}
async function store(location_id, user_id, status='initializing') {
    let doc = { location_id, status, last_activity: Date.now() };
    if (user_id) doc.user_id = user_id; // optional
    let item = await ClientModel.findOne({location_id});
    if (item) console.log('::: db record exists')
    console.log('::: updating: ', doc)
    return (item) ? await item.updateOne(doc) : await ClientModel.create(doc);
}
async function remove(location_id) {
    const doc = { location_id };
    await ClientModel.deleteMany(doc);
}

module.exports = { showClients, store, remove }