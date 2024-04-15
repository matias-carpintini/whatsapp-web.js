# whatsapp-web.js
A WhatsApp API client that connects through the WhatsApp Web browser app

It uses Puppeteer to run a real instance of Whatsapp Web to avoid getting blocked.

**NOTE:** I can't guarantee you will not be blocked by using this method, although it has worked for me. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.

## Quick Links

* [Guide / Getting Started](https://wwebjs.dev/guide) _(work in progress)_
* [Reference documentation](https://docs.wwebjs.dev/)
* [GitHub](https://github.com/pedroslopez/whatsapp-web.js)
* [npm](https://npmjs.org/package/whatsapp-web.js)

## Installation

* Use recent NodeJS versions > 18 *nvm use recommended.

The module is now available on npm! `npm i whatsapp-web.js`

Please note that Node v18+ is required.

## Example usage

```js
const { Client } = require('whatsapp-web.js');

const client = new Client();

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('QR RECEIVED', qr);
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();
```

Take a look at [example.js](https://github.com/pedroslopez/whatsapp-web.js/blob/master/example.js) for another example with more use cases.

For more information on saving and restoring sessions, check out the available [Authentication Strategies](https://wwebjs.dev/guide/authentication.html).


## Supported features

| Feature  | Status |
| ------------- | ------------- |
| Multi Device  | ✅  |
| Send messages  | ✅  |
| Receive messages  | ✅  |
| Send media (images/audio/documents)  | ✅  |
| Send media (video)  | ✅ [(requires google chrome)](https://wwebjs.dev/guide/handling-attachments.html#caveat-for-sending-videos-and-gifs)  |
| Send stickers | ✅ |
| Receive media (images/audio/video/documents)  | ✅  |
| Send contact cards | ✅ |
| Send location | ✅ |
| Send buttons | ❌ |
| Send lists | ❌  [(DEPRECATED)](https://www.youtube.com/watch?v=hv1R1rLeVVE) |
| Receive location | ✅ | 
| Message replies | ✅ |
| Join groups by invite  | ✅ |
| Get invite for group  | ✅ |
| Modify group info (subject, description)  | ✅  |
| Modify group settings (send messages, edit info)  | ✅  |
| Add group participants  | ✅  |
| Kick group participants  | ✅  |
| Promote/demote group participants | ✅ |
| Mention users | ✅ |
| Mute/unmute chats | ✅ |
| Block/unblock contacts | ✅ |
| Get contact info | ✅ |
| Get profile pictures | ✅ |
| Set user status message | ✅ |
| React to messages | ✅ |
| Vote in polls | 🔜 |
| Create polls | ✅ |

Something missing? Make an issue and let us know!

## Contributing

Pull requests are welcome! If you see something you'd like to add, please do. For drastic changes, please open an issue first.

## Supporting the project

You can support the maintainer of this project through the links below

- [Support via GitHub Sponsors](https://github.com/sponsors/pedroslopez)
- [Support via PayPal](https://www.paypal.me/psla/)
- [Sign up for DigitalOcean](https://m.do.co/c/73f906a36ed4) and get $200 in credit when you sign up (Referral)

## Disclaimer

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates. The official WhatsApp website can be found at https://whatsapp.com. "WhatsApp" as well as related names, marks, emblems and images are registered trademarks of their respective owners.

## License

Copyright 2019 Pedro S Lopez

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this project except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## Fork addings

### Mongo DB Installation
- wget mongodb-org-server-7.0.8-1.amzn2023.x86_64.rpm
- yum install mongodb-org-server-7.0.8-1.amzn2023.x86_64.rpm
- sudo systemctl start mongod
- sudo tail /var/log/mongodb/mongod.log to see logs


### Pupeeteer / Chromium Build (Server)

- Pupeeteer/Core is running: 18.2.1
- Installing chrome-linux:  /home/ec2-user/whatsapp-web.js/node_modules/puppeteer-core/.local-chromium/linux-1045629/chrome-linux/chrome