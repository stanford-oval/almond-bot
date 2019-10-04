import { ActivityHandler } from 'botbuilder';

export default class AlmondBot extends ActivityHandler {
  private conversationState;
  private userState;
  private dialog;
  private dialogState;
  /**
   *
   * @param {ConversationState} conversationState
   * @param {UserState} userState
   * @param {Dialog} dialog
   */
  constructor(conversationState, userState, dialog) {
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

    this.conversationState = conversationState;
    this.userState = userState;
    this.dialog = dialog;
    this.dialogState = this.conversationState.createProperty('DialogState');

    this.onMessage(async (context, next) => {
      console.log('Running dialog with Message Activity.');

      // Run the Dialog with the new message Activity.
      await this.dialog.run(context, this.dialogState);

      await next();
    });

    this.onDialog(async (context, next) => {
      // Save any state changes. The load happened during the execution of the Dialog.
      await this.conversationState.saveChanges(context, false);
      await this.userState.saveChanges(context, false);

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (const member of membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity(
            'Welcome to AuthenticationBot. Type anything to get logged in. Type "logout" to sign-out.'
          );
        }
      }

      await next();
    });

    this.onTokenResponseEvent(async (context, next) => {
      console.log('Running dialog with Token Response Event Activity.');
      await this.dialog.run(context, this.dialogState);

      await next();
    });
  }
}
