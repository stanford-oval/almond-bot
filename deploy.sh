#!/bin/bash
SUBSCRIPTION="Free Trial"
RESOURCE_GROUP_NAME=Almond
WEB_APP_NAME="almond-bot"
APP_ID=$ALMOND_APP_ID
APP_PASSWORD=$ALMOND_APP_PASSWORD

yarn build

az login
az account set --subscription "${SUBSCRIPTION}"
#az ad app create --display-name "almond-bot" --password "m(UW9N;-g[WPXDNa" --available-to-other-tenants
az bot create --kind webapp --resource-group "${RESOURCE_GROUP_NAME}" --name "${WEB_APP_NAME}" --appid "${APP_ID}" --password "${APP_PASSWORD}" --lang Javascript
rm -f web.config
az bot prepare-deploy --code-dir "." --lang Typescript
rm -f code.zip
zip -r code.zip src
az webapp deployment source config-zip --resource-group "${RESOURCE_GROUP_NAME}" --name "${WEB_APP_NAME}" --src "code.zip"
