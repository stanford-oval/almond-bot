import {
  ConfirmPrompt,
  DialogSet,
  DialogTurnStatus,
  OAuthPrompt,
  WaterfallDialog,
  TextPrompt
} from 'botbuilder-dialogs';
import axios from 'axios';
import Config from '../config';

import LogoutDialog from './logoutDialog';

const CONFIRM_PROMPT = 'ConfirmPrompt';
const MAIN_DIALOG = 'MainDialog';
const MAIN_WATERFALL_DIALOG = 'MainWaterfallDialog';
const OAUTH_PROMPT = 'OAuthPrompt';
const ALMOND_DIALOG = 'AlmondDialog';
const ALMOND_TEXT_PROMPT = 'AlmondTextPrompt';

export default class MainDialog extends LogoutDialog {
  private dialogState;

  constructor() {
    super(MAIN_DIALOG, process.env.connectionName);

    this.addDialog(
      new OAuthPrompt(OAUTH_PROMPT, {
        connectionName: process.env.connectionName,
        text: 'Please Sign In',
        title: 'Sign In',
        timeout: 300000
      })
    );
    this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
    this.addDialog(
      new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
        this.promptStep.bind(this),
        this.loginStep.bind(this)
      ])
    );
    this.addDialog(
      new WaterfallDialog(ALMOND_DIALOG, [
        this.commandStep.bind(this),
        this.almondStep.bind(this)
      ])
    );
    this.addDialog(new TextPrompt(ALMOND_TEXT_PROMPT));

    this.initialDialogId = MAIN_WATERFALL_DIALOG;
  }

  /**
   * The run method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
   * If no dialog is active, it will start the default dialog.
   * @param {*} dialogContext
   */
  public async run(context, accessor) {
    this.dialogState = accessor;

    const dialogSet = new DialogSet(accessor);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(context);
    const results = await dialogContext.continueDialog();
    if (results.status === DialogTurnStatus.empty) {
      await dialogContext.beginDialog(this.id);
    }
  }

  public async promptStep(stepContext) {
    return await stepContext.beginDialog(OAUTH_PROMPT);
  }

  public async loginStep(stepContext) {
    // Get the token from the previous step. Note that we could also have gotten the
    // token directly from the prompt itself. There is an example of this in the next method.
    const tokenResponse = stepContext.result;
    if (!tokenResponse) {
      await stepContext.context.sendActivity(
        'Login was not successful please try again.'
      );
      return await stepContext.endDialog();
    }

    // save token in state
    this.dialogState.authToken = tokenResponse.token;

    await stepContext.context.sendActivity('You are now logged in.');
    await stepContext.context.sendActivity('What can I do for you?');

    return await stepContext.beginDialog(ALMOND_DIALOG);
  }

  public async commandStep(stepContext) {
    return await stepContext.prompt(ALMOND_TEXT_PROMPT);
  }

  public async almondStep(stepContext) {
    // Query Almond Server and return result
    const request = {
      command: {
        type: 'command',
        text: stepContext.result
      },
    };
    const config = {
      baseURL: Config.ALMOND_API_URL,
      headers: {
        Authorization: `Bearer ${this.dialogState.authToken}`
      }
    };

    await axios
      .post('/converse', request, config)
      .then(async (res: any) => {
        // store conversation token
        this.dialogState.conversationId = res.conversationId;

        // sequential message execution
        res.messages.reduce(
          (p: any, msg: any) =>
            p.then(_ => this.displayMessage(msg, stepContext)),
          Promise.resolve()
        );
      })
      .catch(async err => {
        console.log(err);
        await stepContext.context.sendActivity(`Can't reach Almond: ${err}`);
      });

    return await stepContext.replaceDialog(ALMOND_DIALOG);
  }

  private async displayMessage(msg: any, stepContext: any) {
    switch (msg.type) {
      case 'text':
        await stepContext.context.sendActivity(msg.text);
        break;
      default:
        await stepContext.context.sendActivity('Unsupported Almond message type.');
        throw 'Unsupported message type.';
    }
  }
}
