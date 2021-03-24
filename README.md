# Signal Desktop with ZK Vault

Signal Desktop is an Electron application that links with Signal.  ZK Vault is a zero-knowledge password manager.  ZK Vault Server is an API supporting the DE-PAKE protocol implemented by ZK Vault.

## Setup

Install required packages (out of the box support for npm via package.json)

Configure server endpoint, key, and database information via config.js (live version runs as App Service with CosmosDB)

## Run

Deploy or Run the application as Server.js

## Connect

Connect from a client via the endpoint in config.js.

Out-of-the-box routes are: /register, /authenticate, and /remove.