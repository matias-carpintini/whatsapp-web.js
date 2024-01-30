# Project Title

## Table of Contents
- [Database](#database)
- [Entry point](#entry_point)
- [Endpoints](#endpoints)
- [The whatsapp-web.js library](#the-whatsapp-web-js-library)
- [ENV variables](#env-variables)
- [Problems encountered](#problems-encountered)
- [Flaky errors](#flaky-errors)

## Database
- No database is used. As we are using RemoteAuth, the session data is stored in a zip in our S3 bucket (see the `.env` file attached to the PR description).

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
- In order to be able to restore sessions we are using a `RemoteAuth` strategy. This strategy is defined in [`src/calendico-whatsapp-js/strategies/RemoteAuth.js`](../strategies/RemoteAuth.js). This is the only way to be able to restore sessions when using multi session devices and not using local storage.
- The cycle of the `RemoteAuth` strategy is:
  1. The `RemoteAuth` strategy is initialized with the `store` object and the `session` object.
  2. The `store` object is used to store the session data in a zip file in our S3 bucket.
  3. The `session` object is used to restore the session from the zip file in our S3 bucket.
  4. The `RemoteAuth` strategy is passed into the `Client` object.
  5. The `Client` object is initialized with the `RemoteAuth` strategy.
  6. The `Client` object is returned to the caller.
- The `store` object passed into the `RemoteAuth` strategy is the [`AWS S3 Store`](https://wwebjs.dev/guide/authentication.html#aws-s3-store) object defined in the `whatsapp-web.js` library docs.
- We are using our S3 bucket, the credentials are defined in the `.env` file attached to the PR description.
- The sessions files are stored in  the `whatsapp-js` folder in the S3 bucket.
- The library uses these two folders to store the local session data:
  1. `src/calendico-whatsapp-js/.wwebjs_auth`
  2. `src/calendico-whatsapp-js/.wwebjs_cache`
    - Note: these 2 objects can be deleted to start the login process from scratch.

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

## ENV variables

- The `.env` file should have this data:
  ```
     AWS_S3_REGION=us-east-2
     AWS_S3_ACCESS_KEY_ID=xxxxx
     AWS_S3_SECRET_ACCES_KEY_ID=xxxx
     AWS_S3_BUCKET_NAME=waitery
     AWS_S3_FOLDER_NAME=whatsapp-js
     RAILS_APP_URL=http://localhost:
     RAILS_APP_PORT=3000
     RAILS_APP_ENDPOINT_SCOPE=/whatsapp_js
  ```

## Problems encountered
- Sometimes the messages are sent but they are not received by the receiver. The message has only one tick, it even appears in the chat but the receiver does not receive it.
  - We are already handling this monitoring the `ack` property of the message. If the message is not received within a few minutes we can retry to send it.
- Sometimes the session doesn't get recovered.
  - We discovered that, for the session to be re stored without having to scan the QR code again, the data must be synchronized and this takes anywhere from 2 to 5 minutes,  perhaps more, depending on the size of the messages to  store. For example, my regular session weights 32Mb and my test session weights 1.5Mb. The test session is restored in 2 minutes and the regular session in 5 minutes, girve  or take.
- The need to  scan a new QR code demands having a modal in the frontend to show the user a message asking them to scan the QR code again.
  


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