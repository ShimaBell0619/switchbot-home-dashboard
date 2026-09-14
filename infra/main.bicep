targetScope = 'resourceGroup'

param location string = resourceGroup().location
param functionPlanName string = 'plan-switchbot-poc-jpe-01'
param functionAppName string = 'func-switchbot-${take(uniqueString(subscription().id, resourceGroup().id), 8)}'
param storageAccountName string = 'stsbhd${take(uniqueString(subscription().id, resourceGroup().id), 12)}'
param deploymentContainerName string = 'deployments'
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

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2025-06-01' = {
  parent: storage
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-06-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
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

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

var currentTableSas = storage.listServiceSas('2025-06-01', {
  canonicalizedResource: '/table/${storage.name}/${toLower(currentTableName)}'
  signedPermission: 'rau'
  signedExpiry: tableSasExpiry
  signedProtocol: 'https'
}).serviceSasToken

var historyTableSas = storage.listServiceSas('2025-06-01', {
  canonicalizedResource: '/table/${storage.name}/${toLower(historyTableName)}'
  signedPermission: 'rau'
  signedExpiry: tableSasExpiry
  signedProtocol: 'https'
}).serviceSasToken

resource functionPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: functionPlanName
  location: location
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'StorageAccountConnectionString'
            storageAccountConnectionStringName: 'AzureWebJobsStorage'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 40
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '24'
      }
    }
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
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
          value: currentTableSas
        }
        {
          name: 'HISTORY_TABLE_NAME'
          value: historyTableName
        }
        {
          name: 'HISTORY_TABLE_SAS'
          value: historyTableSas
        }
        {
          name: 'STALE_AFTER_SECONDS'
          value: '900'
        }
      ]
    }
  }
  dependsOn: [
    deploymentContainer
    currentTable
    historyTable
  ]
}

output functionAppName string = functionApp.name
output apiBaseUrl string = 'https://${functionApp.properties.defaultHostName}'
output storageAccountName string = storage.name
