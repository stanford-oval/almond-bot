import { ActivityHandler } from "botbuilder";
import qs from "qs";
import Config from "../config";

const CONVERSATION_DATA_PROPERTY = "conversationData";
const USER_PROFILE_PROPERTY = "userProfile";
const PRIVATE_CONVERSATION_DATA_PROPERTY = "privateConversationData";

export default class AlmondBot extends ActivityHandler {
  private conversationState;
  private userState;
  private privateConversationState;
  private dialog;
  private dialogState;
  private convDataAccessor;
  private userProfileAccessor;
  private privateConvDataAccessor;
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
        "[AlmondBot]: Missing parameter. conversationState is required"
      );
    }
    if (!userState) {
      throw new Error("[AlmondBot]: Missing parameter. userState is required");
    }
    if (!dialog) {
      throw new Error("[AlmondBot]: Missing parameter. dialog is required");
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
    this.dialogState = this.conversationState.createProperty("DialogState");

    this.onMessage(async (context, next) => {
      console.log("Running dialog with Message Activity.");

      // Run the Dialog with the new message Activity.
      await this.dialog.run(context, this.dialogState);

      await next();
    });

    this.onDialog(async (context, next) => {
      console.log('On Dialog');
      console.log(context);
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
          await context.sendActivity("Type anything to get logged in.");
          await context.sendActivity('Or type "logout" to sign-out.');
        }
      }

      await next();
    });

    this.onTokenResponseEvent(async (context, next) => {
      console.log("Running dialog with Token Response Event Activity.");
      await this.dialog.run(context, this.dialogState);

      await next();
    });
  }

  /*
  private async doConnect() {
    const options = { id: this._id, hide_welcome: true };

    const url =
      Config.WEB_ALMOND_URL +
      "/me/api/" +
      (this._user.access_token ? "conversation" : "anonymous") +
      "?" +
      qs.stringify(options);
    console.log(`Context ${this._id}: connecting web socket to ${url}`);

    const headers = {
      Origin: Config.WEB_ALMOND_URL
    };
    if (this._user.access_token)
      headers["Authorization"] = `Bearer ${this._user.access_token}`;

    this._ws = new WebSocket(url, [], { headers });
    this._ws.on("close", () => {
      console.log(`Context ${this._id}: closed`);
      this._ws = null;
    });
    this._ws.on("error", e => {
      console.error(`Error on Web Almond web socket: ${e.message}`);
    });
    this._ws.on("open", () => {
      console.log(`Context ${this._id}: connected`);
      // wait to process incoming messages until we get the first ask_special
      // this ensures that almond does not get confused by processing a message during initialization
      // (and discarding it)
      this._pumpingIncomingMessages = false;
    });
    this._ws.on("message", data => {
      const message = JSON.parse(data);
      this._outgoingMessageQueue.push(message);
    });
  }

  private escapeMessageText(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/>/g, "&gt;")
      .replace(/</g, "&lt;");
  }

  private async pumpIncomingMessageQueue() {
    this._pumpingIncomingMessages = true;
    try {
      for (;;) {
        let message = await this._incomingMessageQueue.pop();
        if (
          !message.activate &&
          (this._currentAskSpecial === null ||
            this._currentAskSpecial === "generic")
        ) {
          console.log(
            `Context ${this._id}: ignored queued message, activate is false and ask special is ${this._currentAskSpecial}`
          );
          continue;
        }

        this._ws.send(JSON.stringify(message.message));
      }
    } catch (e) {
      console.error(`Error on Web Almond web socket: ${e.message}`);
    }
  }

  private async pumpOutgoingMessageQueue() {
    // TODO: consecutive messages (up to ask special) should be collapsed into a single rich
    // slack message
    for (;;) {
      let message = await this._outgoingMessageQueue.pop();
      try {
        switch (message.type) {
          case "text":
            await this._client.sendMessage(message.text, this._channel);
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
