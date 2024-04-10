const { ClientModel } = require('./db');
function showClients(status = 'active') {
    const items = ClientModel.find().then((items) => {

        console.log(items.map((i) => i.location_id))
    })
    return items;
}
async function store(location_id, user_id){
    const doc = { location_id, user_id };
    const item = await ClientModel.findOne(doc);
    return item || ClientModel.create(doc);
}
async function remove(location_id) {
    const doc = { location_id };
    await ClientModel.delete(doc);
}

module.exports = { showClients, store, remove }