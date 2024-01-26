# Project Title

## Table of Contents
- [Database](#database)
- [Entry point](#entry_point)
- [Endpoints](#endpoints)
- [The whatsapp-web.js library](#the-whatsapp-web-js-library)
- [Problems encountered](#problems-encountered)

## Database
- The database used is PostgreSQL.
- You need to create a DB called `whatsapp_web_js`and a `.env` file in the root of the project, next to the `.env.example` with this content:
    ```
    DB_USER=your_user
    DB_HOST=localhost
    DB_DATABASE=whatsapp_web_js
    DB_PASSWORD=your_pass
    DB_PORT=5432
    ```
- When deployed to Heroku, the values will be taken from the ENV variables.

## Entry point
- The entry point for the project is [`src/calendico-whatsapp-js/app.js`](../app.js).
  1. It initializes the express server.
  2. Starts listening to requests through the routes defined in [`src/calendico-whatsapp-js/routes`](../endpoints/routes.js).
  3. The port, for now, is set to 8093.

## Endpoints
- The endpoints are defined in [`src/calendico-whatsapp-js/routes`](../endpoints/routes.js) and are:
  1. `/login` (POST)
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
  2. `/logout` (POST)
      - This endpoint is used to logout of WhatsApp. It is used jsut like the login endpoint.
        - The request body should be a JSON object with the following fields:
        1. `location_identifier`: The is of the location logging out.
        2. `user_id`: The user who triggered the logout sequence.
      - The `logoutClient` service fetches the client from the clients drawer object defined in [`src/calendico-whatsapp-js/clients/ClientsConnected.js`](../clients/ClientsConnected.js).
        - If the client is not found, the `initializeWhatsAppClient` function is called to initialize the client.
        - If the client is found, then the `logout` function is called to logout the client. This is handled by the `whatsapp-web.js` library.
  3. `/send_message` (POST)
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
  4`/chats` (GET)
      - This endpoint is used to get a certain number of chats from the location:
          - The request is a get request with the following query params (for location 13 and to get 10 messages for every chat)
            1. location_identifier=13
            2. chats_to_get=10
          - The response is a JSON object with the following fields:
            ```JSON
              "code": 200,
              "status": "success",
              "body": {
                       "Chat name": {
                       "groupChat": false,
                       "messages": [
                                    {
                                      "from": "5491134525535",
                                      "fromMe": true,
                                      "body": "🤖 *Gracias por escribir a nuestra línea automática de turnos (desde aquí recibirás tus notificaciones).*\n\nPara gestionar tus turnos, pulsa el link👇🏼\nhttps://app.calendico.com/beauty-shop\n"
                                      },
                                   ]
                      }
            ```
  5`/contacts` (GET)
     - This endpoint is used to get all the contacts from the chats of the location:
         - The request is a get request with the following query params (for location 13)
             1. location_identifier=13
         - The response is a JSON object with the following fields:
           ```JSON
             "code": 200,
             "status": "success",
             "body": [
                      {
                        "id": {
                                "server": "c.us",
                                "user": "5493815879150",
                                "_serialized": "5493815879150@c.us"
                              },
                        "isMe": false,
                        "name": "Miguel Tuc",
                        "pushname": "Tucu Gomez",
                        "shortName": "Miguel Tuc",
                        "number": "5493815879150",
                        "isGroup": false,
                        "isMyContact": true,
                        "isWAContact": true
                      },
                      ...
           ```

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

## Events
- The client object listens to events emitted by the `whatsapp-web.js` library.
- CUrrently, we listen to:
  1. `qr`: This event is emitted when the QR code is generated.
  2. `authenticated`: This event is emitted when the client is authenticated.
  3. `auth_failure`: This event is emitted when the client fails to authenticate.
  4. `ready`: This event is emitted when the client is ready to be used.
  5. `disconnected`: This event is emitted when the client is disconnected. The session is deleted from the DB.
  6. `message`: This event is emitted when a message is received.
  7. `remote_session_saved`: This event is emitted when the session is saved in the zip file. This can take a minute or so.
  8. `message_ack`: This event is emitted when a message is sent. We can store the message, receiver and serialized_id into the db and mark it as received when we receive this event. If the message doesn't get received within a few minutes we can retry to send it. The ack value is an integer that can be:
    ```
      == ACK VALUES ==
      ACK_ERROR: -1
      ACK_PENDING: 0
      ACK_SERVER: 1
      ACK_DEVICE: 2
      ACK_READ: 3
      ACK_PLAYED: 4

      These are the empirical results of sending a message and listening to the `message_ack` event for a message sent to a private chat:

      Sending the message:
      message serialized_id: true_5493815879150@c.us_3EB0D0AC7CBC42DA0FB680 
      message ack value:     0


      First event received:
      message serialized_id: true_5493815879150@c.us_3EB0D0AC7CBC42DA0FB680 
      message ack value:     1


      Second event received:
      message serialized_id: true_5493815879150@c.us_3EB0D0AC7CBC42DA0FB680 
      message ack value:     2

      Third event received:
      message serialized_id: true_5493815879150@c.us_3EB0D0AC7CBC42DA0FB680 
      message ack value:     3
    ```

## Problems encountered
- Sometimes the messages are sent but they are not received by the receiver. The message has only one tick, it even appears in the chat but the receiver does not receive it.
- Sometimes the session doesn't get recovered.
- A lost session scenario might be handled but we need rails to be able to react to new QR codes sent to restore the session.


## Flaky errors
```
> node app.js
Server running on port 8093
============================================
Client not initialized yet. Initializing...
============================================
Initializing WhatsApp client for 13 by user automatic_reconnect...
Connected to the SQLite database.
----------------------------------------------------------------------------------------------
this.userDataDir:  /Users/TucuGomez/Documents/whatsapp-web.js/src/calendico-whatsapp-js/.wwebjs_auth/RemoteAuth-13
this.sessionName:  RemoteAuth-13
----------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------
start extractRemoteSession
----------------------------------------------------------------------------------------------
pathExists:  true
this.userDataDir:  /Users/TucuGomez/Documents/whatsapp-web.js/src/calendico-whatsapp-js/.wwebjs_auth/RemoteAuth-13
sessionExists:  true
this.userDataDir:  RemoteAuth-13
compressedSessionPath:  /Users/TucuGomez/Documents/whatsapp-web.js/src/calendico-whatsapp-js/.wwebjs_auth/RemoteAuth-13.zip
----------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------
compressedSessionPath:  /Users/TucuGomez/Documents/whatsapp-web.js/src/calendico-whatsapp-js/.wwebjs_auth/RemoteAuth-13.zip
----------------------------------------------------------------------------------------------
1#######################################################
authEventPayload:
undefined
2#######################################################
1----------------------------------------------------------------------------------------------
Starting to save session for location: 13
This can take up to a minute depending on the size of the session data, so please wait.
1----------------------------------------------------------------------------------------------
============================================
client.getState(): CONNECTED
============================================
Error: Error: Evaluation failed: TypeError: Cannot read properties of undefined (reading 'sendSeen')
    at __puppeteer_evaluation_script__:7:37
    at ExecutionContext._evaluateInternal (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/puppeteer/lib/cjs/puppeteer/common/ExecutionContext.js:221:19)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at async ExecutionContext.evaluate (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/puppeteer/lib/cjs/puppeteer/common/ExecutionContext.js:110:16)
    at async Client.sendMessage (/Users/TucuGomez/Documents/whatsapp-web.js/src/Client.js:905:28)
    at async send_message_to_client (/Users/TucuGomez/Documents/whatsapp-web.js/src/calendico-whatsapp-js/services/sendMessageToClient.js:33:39)
```

```
Error: Error: Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed.
    at CDPSession.send (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/puppeteer/lib/cjs/puppeteer/common/Connection.js:218:35)
    at ExecutionContext._evaluateInternal (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/puppeteer/lib/cjs/puppeteer/common/ExecutionContext.js:204:50)
    at ExecutionContext.evaluate (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/puppeteer/lib/cjs/puppeteer/common/ExecutionContext.js:110:27)
    at DOMWorld.evaluate (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/puppeteer/lib/cjs/puppeteer/common/DOMWorld.js:97:24)
    at runMicrotasks (<anonymous>)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client
    at new NodeError (node:internal/errors:371:5)
    at ServerResponse.setHeader (node:_http_outgoing:576:11)
    at ServerResponse.header (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/express/lib/response.js:794:10)
    at ServerResponse.send (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/express/lib/response.js:174:12)
    at ServerResponse.json (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/express/lib/response.js:278:15)
    at send_message_to_client (/Users/TucuGomez/Documents/whatsapp-web.js/src/calendico-whatsapp-js/services/sendMessageToClient.js:57:33)
    at runMicrotasks (<anonymous>)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at async /Users/TucuGomez/Documents/whatsapp-web.js/src/calendico-whatsapp-js/endpoints/routes.js:12:12 {
  code: 'ERR_HTTP_HEADERS_SENT'
}
node:internal/errors:464
    ErrorCaptureStackTrace(err);
    ^

Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client
    at new NodeError (node:internal/errors:371:5)
    at ServerResponse.setHeader (node:_http_outgoing:576:11)
    at ServerResponse.header (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/express/lib/response.js:794:10)
    at ServerResponse.send (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/express/lib/response.js:174:12)
    at ServerResponse.json (/Users/TucuGomez/Documents/whatsapp-web.js/node_modules/express/lib/response.js:278:15)
    at send_message_to_client (/Users/TucuGomez/Documents/whatsapp-web.js/src/calendico-whatsapp-js/services/sendMessageToClient.js:62:25)
    at runMicrotasks (<anonymous>)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
    at async /Users/TucuGomez/Documents/whatsapp-web.js/src/calendico-whatsapp-js/endpoints/routes.js:12:12 {
  code: 'ERR_HTTP_HEADERS_SENT'
}

```