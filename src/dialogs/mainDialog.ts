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
const urljoin = require('url-join');

import LogoutDialog from './logoutDialog';
import {
  CardFactory,
  MessageFactory,
  ActionTypes,
  ActivityTypes,
  CardAction
} from 'botbuilder';

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

    // save token in state if in prod, otherwise load from env
    this.dialogState.authToken = tokenResponse.token;
    // comment out below if in prod. If in dev, keep.
    // this.dialogState.authToken = process.env.TemporaryOAuthToken;

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
        text: stepContext.result,
        type: 'command'
      },
      conversationId: this.dialogState.conversationId
    };
    const config = {
      baseURL: Config.ALMOND_API_URL,
      headers: {
        Authorization: `Bearer ${this.dialogState.authToken}`
      }
    };

    // send typing indicator
    await stepContext.context.sendActivity({ type: ActivityTypes.Typing });

    await axios
      .post('/converse', request, config)
      .then(async (res: any) => {
        console.log(res.data);

        // store conversation token
        this.dialogState.conversationId = res.data.conversationId;

        // sequential message execution
        res.data.messages
          .reduce(
            (p: any, msg: any) =>
              p.then(_ => {
                this.handleMessage(msg, stepContext).catch((_: any) => null);
              }),
            Promise.resolve()
          )
          .then(async _ => {
            // handle askSpecial
            await this.handleSpecial(res.data.askSpecial, stepContext);
          })
          .catch(_ => null);
      })
      .catch(async (err: any) => {
        console.log(err);
        await stepContext.context.sendActivity(`Can't reach Almond: ${err}`);
      });

    return await stepContext.replaceDialog(ALMOND_DIALOG);
  }

  private async handleMessage(msg: any, stepContext: any) {
    let card;
    let message;
    let buttons: CardAction[];
    switch (msg.type) {
      case 'button':
        // TODO
        break;
      case 'choice':
        buttons = [
          {
            type: ActionTypes.ImBack,
            title: msg.title,
            value: msg.title
          }
        ];
        card = CardFactory.heroCard(null, null, buttons);
        message = MessageFactory.attachment(card);
        await stepContext.context.sendActivity(message);
        break;
      case 'link':
        buttons = [
          {
            type: ActionTypes.OpenUrl,
            title: msg.title,
            value: urljoin(Config.ALMOND_API_URL, msg.url)
          }
        ];
        card = CardFactory.heroCard(null, null, buttons);
        message = MessageFactory.attachment(card);
        await stepContext.context.sendActivity(message);
        break;
      case 'picture':
        // get content type from url
        const contentType = msg.url
          .split('?')[0]
          .split('.')
          .pop();

        message = MessageFactory.attachment({
          contentType: `image/${contentType}`,
          contentUrl: msg.url
        });
        await stepContext.context.sendActivity(message);
        break;
      case 'rdl':
        buttons = [
          {
            type: ActionTypes.OpenUrl,
            title: 'View',
            value: msg.rdl.webCallback
          }
        ];

        if (msg.rdl.displayText) {
          card = CardFactory.heroCard(
            msg.rdl.displayTitle,
            msg.rdl.displayText,
            [],
            buttons
          );
        } else {
          card = CardFactory.heroCard(msg.rdl.displayTitle, [], buttons);
        }
        console.log(card);
        message = MessageFactory.attachment(card);
        await stepContext.context.sendActivity(message);
        break;
      case 'text':
        await stepContext.context.sendActivity(msg.text);
        break;
      default:
        await stepContext.context.sendActivity(
          'Unsupported Almond message type.'
        );
        throw new Error(`Unsupported message type: ${msg.type}`);
    }
  }

  /**
   * Handle askSpecial indicators.
   */
  private async handleSpecial(askSpecial: string, stepContext: any) {
    if (!askSpecial) return;

    let card;
    let message;
    let buttons;
    switch (askSpecial) {
      case 'yesno':
        buttons = [
          {
            type: ActionTypes.ImBack,
            title: 'Yes',
            value: 'Yes'
          },
          {
            type: ActionTypes.ImBack,
            title: 'No',
            value: 'No'
          }
        ];
        card = CardFactory.heroCard(null, null, buttons);
        message = MessageFactory.attachment(card);
        await stepContext.context.sendActivity(message);
        break;
      default:
        return;
    }
  }
}
