import { ActivityHandler } from 'botbuilder';
import Config from '../config';
const WebSocket = require('isomorphic-ws');
const qs = require('qs');

const CONVERSATION_DATA_PROPERTY = 'conversationData';
const USER_PROFILE_PROPERTY = 'userProfile';
const PRIVATE_CONVERSATION_DATA_PROPERTY = 'privateConversationData';

export default class AlmondBot extends ActivityHandler {
  private conversationState;
  private userState;
  private privateConversationState;
  private dialog;
  private dialogState;
  private convDataAccessor;
  private userProfileAccessor;
  private privateConvDataAccessor;
  private id;
  private ws;
  private pumpingIncomingMessages;
  private incomingMessageQueue;
  private outgoingMessageQueue;
  private currentAskSpecial;
  private channel;
  private client;
  /**
   *
   * @param {ConversationState} conversationState
   * @param {UserState} userState
   * @param {PrivateConversationState} privateConversationState
   * @param {Dialog} dialog
   */
  constructor(conversationState, userState, privateConversationState, dialog) {
    super();
    if (!conversationState) {
      throw new Error(
        '[AlmondBot]: Missing parameter. conversationState is required'
      );
    }
    if (!userState) {
      throw new Error('[AlmondBot]: Missing parameter. userState is required');
    }
    if (!dialog) {
      throw new Error('[AlmondBot]: Missing parameter. dialog is required');
    }

    this.convDataAccessor = conversationState.createProperty(
      CONVERSATION_DATA_PROPERTY
    );
    this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);
    this.privateConvDataAccessor = privateConversationState.createProperty(
      PRIVATE_CONVERSATION_DATA_PROPERTY
    );

    this.conversationState = conversationState;
    this.userState = userState;
    this.privateConversationState = privateConversationState;
    this.dialog = dialog;
    this.dialogState = this.conversationState.createProperty('DialogState');

    this.onMessage(async (context, next) => {
      console.log('Running dialog with Message Activity.');

      context.sendActivity(`WS: ${this.ws}`);

      // Run the Dialog with the new message Activity.
      await this.dialog.run(context, this.dialogState);

      await next();
    });

    this.onDialog(async (context, next) => {
      // Save any state changes. The load happened during the execution of the Dialog.
      await this.conversationState.saveChanges(context, false);
      await this.userState.saveChanges(context, false);
      await this.privateConversationState.saveChanges(context, false);

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (const member of membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity("Hi, I'm Almond!");
          await context.sendActivity('Type anything to get logged in.');
          await context.sendActivity('Or type "logout" to sign-out.');
        }
      }

      await next();
    });

    this.onTokenResponseEvent(async (context, next) => {
      console.log('**********************************************');
      console.log(context.activity.value);

      // Store auth token
      if (context.activity && context.activity.value) {
        this.privateConvDataAccessor.authToken = context.activity.value.token;
        this.doConnect();
      }

      console.log(this.privateConvDataAccessor);

      console.log('Running dialog with Token Response Event Activity.');
      await this.dialog.run(context, this.dialogState);

      await next();
    });
  }

  private async doConnect() {
    const options = { id: this.id, hide_welcome: true };
    const token = this.privateConvDataAccessor.authToken;

    if (!token) {
      console.log("Can't connect, not logged in!");
      return;
    }

    const url = `ws://almond.stanford.edu/me/api/conversation/`;
    const headers = {
      Connection: 'Upgrade',
      Origin: Config.WEB_ALMOND_URL,
      Upgrade: 'websocket',
      Authorization: `Bearer ${token}`
    };

    console.log(`Context ${this.id}: connecting web socket to ${url}`);
    this.ws = new WebSocket(url, headers);

    this.ws.onopen = () => {
      console.log('*************** Connected *****************');
    };
    this.ws.onclose = () => {
      console.log('*************** Disconnected *****************');
      this.ws = null;
    };
    this.ws.onmessage = (data: any) => {
      console.log(`Data: ${data}`);
    };
    this.ws.onerror = (e: any) => {
      console.log(`doConnect Socket Error: ${e.message}`);
    };
  }

  /*
    const url =
      Config.WEB_ALMOND_URL + "/me/api/" + token + "?" + qs.stringify(options);
    console.log(`Context ${this.id}: connecting web socket to ${url}`);

    const headers = {
      Origin: Config.WEB_ALMOND_URL
    };
    headers["Authorization"] = `Bearer ${token}`;

    this.ws = new WebSocket(url, []);
    this.ws.on("close", () => {
      console.log(`Context ${this.id}: closed`);
      this.ws = null;
    });
    this.ws.on("error", e => {
      console.error(`Error on Web Almond web socket: ${e.message}`);
    });
    this.ws.on("open", () => {
      console.log(`Context ${this.id}: connected`);
      // wait to process incoming messages until we get the first ask_special
      // this ensures that almond does not get confused by processing a message during initialization
      // (and discarding it)
      this.pumpingIncomingMessages = false;
    });
    this.ws.on("message", data => {
      const message = JSON.parse(data);
      this.outgoingMessageQueue.push(message);
    });
  }

  private escapeMessageText(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/>/g, "&gt;")
      .replace(/</g, "&lt;");
  }

  private async pumpIncomingMessageQueue() {
    this.pumpingIncomingMessages = true;
    try {
      for (;;) {
        let message = await this.incomingMessageQueue.pop();
        if (
          !message.activate &&
          (this.currentAskSpecial === null ||
            this.currentAskSpecial === "generic")
        ) {
          console.log(
            `Context ${this.id}: ignored queued message, activate is false and ask special is ${this.currentAskSpecial}`
          );
          continue;
        }

        this.ws.send(JSON.stringify(message.message));
      }
    } catch (e) {
      console.error(`Error on Web Almond web socket: ${e.message}`);
    }
  }

  private async pumpOutgoingMessageQueue() {
    // TODO: consecutive messages (up to ask special) should be collapsed into a single rich
    // slack message
    for (;;) {
      let message = await this.outgoingMessageQueue.pop();
      try {
        switch (message.type) {
          case "text":
            await this.client.sendMessage(message.text, this.channel);
            break;
          default:
            console.log(`ERROR: Unsupported Message Type ${message.type}`);
            break;
        }
      } catch (e) {
        console.error(`Failed to send message to Slack: ${e.message}`);
      }
    }
  }
  */
}
