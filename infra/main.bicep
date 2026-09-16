targetScope = 'resourceGroup'

param location string = resourceGroup().location
param containerImage string
@secure()
param switchBotToken string
@secure()
param switchBotSecret string
@secure()
param switchBotDeviceId string

param environmentName string = 'cae-switchbot-poc-jpe-01'
param apiAppName string = 'ca-switchbot-api-jpe-01'
param collectorJobName string = 'caj-switchbot-collector-jpe-01'
param storageAccountName string = 'stsbhd${take(uniqueString(subscription().id, resourceGroup().id), 12)}'
param currentTableName string = 'CurrentState'
param historyTableName string = 'SensorReadings'
param tableSasExpiry string = dateTimeAdd(utcNow(), 'P365D')

resource storage 'Microsoft.Storage/storageAccounts@2025-06-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2025-06-01' = {
  parent: storage
  name: 'default'
}

resource currentTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2025-06-01' = {
  parent: tableService
  name: currentTableName
}

resource historyTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2025-06-01' = {
  parent: tableService
  name: historyTableName
}

var currentTableReadSas = storage.listServiceSas('2025-06-01', {
  canonicalizedResource: '/table/${storage.name}/${toLower(currentTableName)}'
  signedPermission: 'r'
  signedExpiry: tableSasExpiry
  signedProtocol: 'https'
}).serviceSasToken

var historyTableReadSas = storage.listServiceSas('2025-06-01', {
  canonicalizedResource: '/table/${storage.name}/${toLower(historyTableName)}'
  signedPermission: 'r'
  signedExpiry: tableSasExpiry
  signedProtocol: 'https'
}).serviceSasToken

var currentTableWriteSas = storage.listServiceSas('2025-06-01', {
  canonicalizedResource: '/table/${storage.name}/${toLower(currentTableName)}'
  signedPermission: 'au'
  signedExpiry: tableSasExpiry
  signedProtocol: 'https'
}).serviceSasToken

var historyTableWriteSas = storage.listServiceSas('2025-06-01', {
  canonicalizedResource: '/table/${storage.name}/${toLower(historyTableName)}'
  signedPermission: 'au'
  signedExpiry: tableSasExpiry
  signedProtocol: 'https'
}).serviceSasToken

resource environment 'Microsoft.App/managedEnvironments@2025-01-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'none'
    }
    zoneRedundant: false
  }
}

resource apiApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: apiAppName
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        allowInsecure: false
        targetPort: 3000
        transport: 'auto'
      }
      secrets: [
        {
          name: 'current-table-sas'
          value: currentTableReadSas
        }
        {
          name: 'history-table-sas'
          value: historyTableReadSas
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: containerImage
          env: [
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'STORAGE_ACCOUNT_NAME'
              value: storage.name
            }
            {
              name: 'CURRENT_TABLE_NAME'
              value: currentTableName
            }
            {
              name: 'CURRENT_TABLE_SAS'
              secretRef: 'current-table-sas'
            }
            {
              name: 'HISTORY_TABLE_NAME'
              value: historyTableName
            }
            {
              name: 'HISTORY_TABLE_SAS'
              secretRef: 'history-table-sas'
            }
            {
              name: 'SWITCHBOT_DEVICE_ID'
              value: switchBotDeviceId
            }
            {
              name: 'STALE_AFTER_SECONDS'
              value: '900'
            }
          ]
          resources: {
            cpu: any('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
  dependsOn: [
    currentTable
    historyTable
  ]
}

resource collectorJob 'Microsoft.App/jobs@2025-01-01' = {
  name: collectorJobName
  location: location
  properties: {
    environmentId: environment.id
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 120
      replicaRetryLimit: 1
      scheduleTriggerConfig: {
        cronExpression: '*/5 * * * *'
        parallelism: 1
        replicaCompletionCount: 1
      }
      secrets: [
        {
          name: 'switchbot-token'
          value: switchBotToken
        }
        {
          name: 'switchbot-secret'
          value: switchBotSecret
        }
        {
          name: 'switchbot-device-id'
          value: switchBotDeviceId
        }
        {
          name: 'current-table-sas'
          value: currentTableWriteSas
        }
        {
          name: 'history-table-sas'
          value: historyTableWriteSas
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'collector'
          image: containerImage
          command: [
            'node'
            'collect.js'
          ]
          env: [
            {
              name: 'SWITCHBOT_TOKEN'
              secretRef: 'switchbot-token'
            }
            {
              name: 'SWITCHBOT_SECRET'
              secretRef: 'switchbot-secret'
            }
            {
              name: 'SWITCHBOT_DEVICE_ID'
              secretRef: 'switchbot-device-id'
            }
            {
              name: 'STORAGE_ACCOUNT_NAME'
              value: storage.name
            }
            {
              name: 'CURRENT_TABLE_NAME'
              value: currentTableName
            }
            {
              name: 'CURRENT_TABLE_SAS'
              secretRef: 'current-table-sas'
            }
            {
              name: 'HISTORY_TABLE_NAME'
              value: historyTableName
            }
            {
              name: 'HISTORY_TABLE_SAS'
              secretRef: 'history-table-sas'
            }
          ]
          resources: {
            cpu: any('0.25')
            memory: '0.5Gi'
          }
        }
      ]
    }
  }
  dependsOn: [
    currentTable
    historyTable
  ]
}

output apiAppName string = apiApp.name
output apiBaseUrl string = 'https://${apiApp.properties.configuration.ingress.fqdn}'
output collectorJobName string = collectorJob.name
output environmentName string = environment.name
output storageAccountName string = storage.name
