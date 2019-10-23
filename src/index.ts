import * as path from "path";
import { config } from "dotenv";
const ENV_FILE = path.join(__dirname, "..", ".env");
config({ path: ENV_FILE });

// Azure App Insights
import * as appInsights from 'applicationinsights';
appInsights.setup(process.env.INSTRUMENTATION_KEY);

import * as restify from "restify";

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
import {
  BotFrameworkAdapter,
  ConversationState,
  MemoryStorage,
  UserState,
  PrivateConversationState
} from "botbuilder";

// This bot's main dialog.
import AlmondBot from "./bots/almondBot";
import MainDialog from "./dialogs/mainDialog";



// Define the state store for your bot.
// See https://aka.ms/about-bot-state to learn more about using MemoryStorage.
// A bot requires a state storage system to persist the dialog and user state between messages.
const memoryStorage = new MemoryStorage();

// Create conversation and user state with in-memory storage provider.
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);
const privateConversationState = new PrivateConversationState(memoryStorage);

// Create the main dialog.
const dialog = new MainDialog();

// Create the bot that will handle incoming messages
const bot = new AlmondBot(
  conversationState,
  userState,
  privateConversationState,
  dialog
);

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const adapter = new BotFrameworkAdapter({
  appId: process.env.MicrosoftAppID,
  appPassword: process.env.MicrosoftAppPassword
});

// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
  // This check writes out errors to console log .vs. app insights.
  console.error(`\n [onTurnError]: ${error}`);
  // Send a message to the user
  await context.sendActivity(`Oops. Something went wrong!`);
  // Clear out state
  await conversationState.delete(context);
};

// Create HTTP server.
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
  console.log(`\n${server.name} listening to ${server.url}`);
});

// Listen for incoming requests.
server.post("/api/messages", (req, res) => {
  adapter.processActivity(req, res, async context => {
    // Route to main dialog.
    await bot.run(context);
  });
});
