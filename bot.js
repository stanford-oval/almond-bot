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
const inQueue = new ConsumerQueue(); // messages coming from user
const outQueue = new ConsumerQueue(); // messages ready to send to user

// Load process.env values from .env file
require('dotenv').config();

let storage = null;
if (process.env.MONGO_URI) {
  storage = mongoStorage = new MongoDbStorage({
    url: process.env.MONGO_URI
  });
}

const controller = new Botkit({
  webhook_uri: '/api/messages',

  adapterConfig: {
    appId: null, // process.env.APP_ID,
    appPassword: null // process.env.APP_PASSWORD,
  },

  storage
});

// For Botkit CMS possible future support
// See: https://botkit.ai/docs/v4/reference/cms.html
if (process.env.cms_uri) {
  controller.usePlugin(
    new BotkitCMSHelper({
      uri: process.env.cms_uri,
      token: process.env.cms_token
    })
  );
}

// Messages received from Almond's web servers
controller.on('message_from_almond', async (bot, message) => {
  if (!message) {
    return;
  }
  console.log('SHOUTING!!!!');
});
// Receiving message from user
controller.on('message', async (bot, message) => {
  ws.send({
    type: 'command',
    text: message.text
  });
});

// catch-all that uses the CMS to trigger dialogs
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

controller.webserver.get('/', (req, res) => {
  res.send(`This app is running Botkit ${controller.version}.`);
});

controller.spawn({}).then(almondBot => {
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
    almondBot.say(message.text);
    console.log(`Message Received: ${message.text}`);
  });
  ws.on('error', e => {
    console.error(`Web Socket Error: ${e.message}`);
  });
});

const processInQueue = async () => {
  for (;;) {
    let message = await outQueue.pop();
    try {
      switch (message.type) {
        case 'text':
          await controller.sendMessage(message.text, this._channel);
          break;
      }
    } catch (e) {
      console.error(`Failed to resolve message from Almond: ${e.message}`);
    }
  }
};
const processOutQueue = async () => {
  try {
    for (;;) {
      let message = await outQueue.pop();
      if (!message.activate) {
        console.log(
          `Context ${this._id}: ignored queued message, activate is false and ask special is ${this._currentAskSpecial}`
        );
        continue;
      }

      ws.send(JSON.stringify(message.message));
    }
  } catch (e) {
    console.error(`Error on Web Almond web socket: ${e.message}`);
  }
};
