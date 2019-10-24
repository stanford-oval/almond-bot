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

          // Run the Dialog with the new message Activity.
          await this.dialog.run(context, this.dialogState);
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
      }

      console.log(this.privateConvDataAccessor);

      console.log('Running dialog with Token Response Event Activity.');
      await this.dialog.run(context, this.dialogState);

      await next();
    });
  }
}
