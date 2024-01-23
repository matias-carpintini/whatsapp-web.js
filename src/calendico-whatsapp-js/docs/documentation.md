# Project Title

## Table of Contents
- [Entry point](#entry_point)
- [Endpoints](#endpoints)
- [The whatsapp-web.js library](#the-whatsapp-web-js-library)
- [Problems encountered](#problems-encountered)

## Entry point
- The entry point for the project is [`src/calendico-whatsapp-js/app.js`](../app.js).
  1. It initializes the express server.
  2. Starts listening to requests through the routes defined in [`src/calendico-whatsapp-js/routes`](../endpoints/routes.js).
  3. The port, for now, is set to 8093.

## Endpoints
- The endpoints are defined in [`src/calendico-whatsapp-js/routes`](../endpoints/routes.js) and are:
  1. `/login`
       - This endpoint is used to login to WhatsApp. The function that handles the request is [`src/calendico-whatsapp-js/services/loginClient.js`](../services/loginClient.js).
         - The request body should be a JSON object with the following fields:
         1. `location_identifier`: The is of the location logging in.
         2. `user_id`: The user who triggered the login sequence.
         - The response is a JSON object with the following fields:
         1. `200`: The login sequence started successfully. Object: `{code: 200, status: 'success', body: 'Initialization process started for ${location_identifier}'`
         2. `400`: One of the params was missing. Object: `{success: false, message: 'The location identifier is required'}`
         3. `500`: An error occurred while starting the login sequence. Object: `{success: false, message: 'Error during login process'}`
       - The `loginClient` service fetches the client from the clients drawer object defined in [`src/calendico-whatsapp-js/clients/ClientsConnected.js`](../clients/ClientsConnected.js).
         - If the client is not found, the `initializeWhatsAppClient` function is called to initialize the client.
         - If the client is found, then there is no need to initialize it again.
         - The client is then returned to the caller. 
  2. `/logout`
      - This endpoint is used to logout of WhatsApp. It is used jsut like the login endpoint.
        - The request body should be a JSON object with the following fields:
        1. `location_identifier`: The is of the location logging out.
        2. `user_id`: The user who triggered the logout sequence.
      - The `logoutClient` service fetches the client from the clients drawer object defined in [`src/calendico-whatsapp-js/clients/ClientsConnected.js`](../clients/ClientsConnected.js).
        - If the client is not found, the `initializeWhatsAppClient` function is called to initialize the client.
        - If the client is found, then the `logout` function is called to logout the client. This is handled by the `whatsapp-web.js` library.
  3. `/send_message`
      - This endpoint is used to send a message to a WhatsApp number.
        - The request body should be a JSON object with the following fields:
        1. `location_identifier`: The WhatsApp number to send the message to.
        2. `receiver_phone`: The message to send.
        3. `message`: The message to send.
      - The response is a JSON object with the following fields:
        1. `success`: A boolean indicating whether the message was sent successfully.
        2. `message`: A string containing the message sent.
        3. `error`: A string containing the error message if the message was not sent successfully.
      - The `sendMessage` service:
        1. fetches the client from the clients drawer object defined in [`src/calendico-whatsapp-js/clients/ClientsConnected.js`](../clients/ClientsConnected.js). If the client is not found, the `initializeWhatsAppClient` function is called to initialize the client and a `400` response is returned to let the rails app that the client is being initialized.
        2. get the client's whatsapp state and, if it is not `CONNECTED`, the `initializeWhatsAppClient` function is called to initialize the client and a `400` response is returned to let the rails app that the client is being initialized.
        3. sends the message using the `sendMessage` function of the `whatsapp-web.js` library.
        4. archives the chat after sending the message.
        5. responds with a `200` response.

## The whatsapp-web.js library
- These are the official docs for the library: https://docs.wwebjs.dev/ and this is the starting guide: https://wwebjs.dev/guide/.
- A directory called `calendar-whatsapp-js` is created in the `src` folder to make easier the updating of the `whatsapp-web.js` library.
- The `Client` is imported from the library and is the object in charge of interacting with the WhatsApp web client using puppeteer.
- In order to be able to restore sessions we are using a `RemoteAuth` strategy. This strategy is defined in [`src/calendico-whatsapp-js/strategies/RemoteAuth.js`](../strategies/RemoteAuth.js). This is the only way to be able to restore sessions when using multi session devices.
- The `store` object passed into the `RemoteAuth` strategy is defined in [`src/calendico-whatsapp-js/services/databaseService.js`](../services/databaseService.js). This is the object that will be used to store the session data. It only stores an object like: `{session: `RemoteAuth-${location_identifier}`}`.
- The library uses these two folders to store the session data and this DB:
  1. `src/calendico-whatsapp-js/.wwebjs_auth`: This folder is used to store the session data for the `RemoteAuth` strategy.
  2. `src/calendico-whatsapp-js/.wwebjs_cache`: This folder is used to store the session data for the `LocalAuth` strategy.
  3. `src/calendico-whatsapp-js/whatsapp_sessions.db`: This file is the SQLite3 database used to store the session data for the `LocalAuth` strategy.
    - Note: these 3 objects can be deleted to start the login process from scratch.

## Problems encountered
- Sometimes the messages are sent but they are not received by the receiver. The message has only one tick, it even appears in the chat but the receiver does not receive it.
- Sometimes the session doesn't get recovered.
- A lost session scenario might be handled but we need rails to be able to react to new QR codes sent to restore the session.
