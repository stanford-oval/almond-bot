//  __   __  ___        ___
// |__) /  \  |  |__/ |  |
// |__) \__/  |  |  \ |  |

// This is the main file for the Almond bot.

// Import Botkit's core features
const { Botkit } = require('botkit');
const { BotkitCMSHelper } = require('botkit-plugin-cms');

// Import a platform-specific adapter for botframework.

const { MongoDbStorage } = require('botbuilder-storage-mongodb');
const WebSocket = require('ws');
const ConsumerQueue = require('consumer-queue');

const ALMOND_SOCKET_URL = 'https://almond.stanford.edu/me/api/anonymous';

// Initialize queues
const incomingQueue = new ConsumerQueue();
const outgoingQueue = new ConsumerQueue();

// Load process.env values from .env file
require('dotenv').config();

let storage = null;
if (process.env.MONGO_URI) {
  storage = mongoStorage = new MongoDbStorage({
    url: process.env.MONGO_URI
  });
}

// Open web socket to almond servers
const headers = {
  Origin: ALMOND_SOCKET_URL
};
const ws = new WebSocket(ALMOND_SOCKET_URL, [], { headers });
ws.on('open', () => {
  console.log('Socket open!');
});
ws.on('close', () => {
  console.log('Socket closed!');
});
ws.on('message', data => {
  const message = JSON.parse(data);
  console.log(`Message Received: ${message.text}`);
});
ws.on('error', e => {
  console.error(`Web Socket Error: ${e.message}`);
});

const controller = new Botkit({
  webhook_uri: '/api/messages',

  adapterConfig: {
    appId: null, // process.env.APP_ID,
    appPassword: null // process.env.APP_PASSWORD,
  },

  storage
});

if (process.env.cms_uri) {
  controller.usePlugin(
    new BotkitCMSHelper({
      uri: process.env.cms_uri,
      token: process.env.cms_token
    })
  );
}

// Once the bot has booted up its internal services, you can use them to do stuff.
controller.ready(() => {
  // load traditional developer-created local custom feature modules
  controller.loadModules(__dirname + '/features');

  /* catch-all that uses the CMS to trigger dialogs */
  if (controller.plugins.cms) {
    controller.on('message,direct_message', async (bot, message) => {
      let results = false;
      results = await controller.plugins.cms.testTrigger(bot, message);

      if (results !== false) {
        // do not continue middleware!
        return false;
      }
    });
  }
});

controller.webserver.get('/', (req, res) => {
  res.send(`This app is running Botkit ${controller.version}.`);
});

const pushToIncomingQueue = () => {};
