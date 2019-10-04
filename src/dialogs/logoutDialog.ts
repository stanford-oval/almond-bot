import { ActivityTypes } from 'botbuilder';
import { ComponentDialog } from 'botbuilder-dialogs';

export default class LogoutDialog extends ComponentDialog {
  private connectionName;

  constructor(id, connectionName) {
    super(id);
    this.connectionName = connectionName;
  }

  public async onBeginDialog(innerDc, options) {
    const result = await this.interrupt(innerDc);
    if (result) {
      return result;
    }

    return await super.onBeginDialog(innerDc, options);
  }

  public async onContinueDialog(innerDc) {
    const result = await this.interrupt(innerDc);
    if (result) {
      return result;
    }

    return await super.onContinueDialog(innerDc);
  }

  public async interrupt(innerDc) {
    if (innerDc.context.activity.type === ActivityTypes.Message) {
      const text = innerDc.context.activity.text.toLowerCase();
      if (text === 'logout') {
        // The bot adapter encapsulates the authentication processes.
        const botAdapter = innerDc.context.adapter;
        await botAdapter.signOutUser(innerDc.context, this.connectionName);
        await innerDc.context.sendActivity('You have been signed out.');
        return await innerDc.cancelAllDialogs();
      }
    }
  }
}
