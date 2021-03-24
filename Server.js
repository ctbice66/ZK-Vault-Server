const express = require('express');
const ecurve = require('ecurve');
const BigI = require('bigi');
const { randomInt } = require('mathjs');
const cors = require('cors');
const CosmosClient = require('@azure/cosmos').CosmosClient;
const server = express();

//database setup
endpoint = process.env.AZURE_COSMOS_ENDPOINT;
key = process.env.AZURE_COSMOS_MASTER_KEY;
databaseID = process.env.AZURE_COSMOS_DATABASE_ID;
containerID = process.env.AZURE_COSMOS_CONTAINER_ID;

//connect to CosmosDB
const client = new CosmosClient({ endpoint, key });

//initialize database context
initializeDBContext(client, databaseID, containerID);

//get database and container objects
const database = client.database(databaseID);
const container = database.container(containerID);

//server config
server.use(express.text());
server.use(cors());

//API Endpoints

//registration for new users
server.post('/register',
async (request, response) => {
	//parse input
	let data = await handleOPRFIn(request.body, container, true);
	
	//send response
	response.send(JSON.stringify(data));
});

//authentication for existing users
server.post('/authenticate',
async (request, response) => {
	//parse input
	let data = await handleOPRFIn(request.body, container, false);
	
	//send response
	response.send(JSON.stringify(data));
});

//record removal for existing users
server.post('/remove',
async (request, response) => {

	//try to delete user
	let status = await deleteUser(container, request.body);

	if (status){

		response.send('User removed');

	}else{

		response.send('User not found');

	}
});

//start server listen
console.log('Server running...');
server.listen(8080);

//handle requests
async function handleOPRFIn(OPRF_in, container, registration){
	
	//define new elliptical curve
	let curve = ecurve.getCurveByName('secp256k1');
	
	//get alpha point
	let OPRF_in_values = JSON.parse(OPRF_in);
	let alpha_buffer = Buffer.from(OPRF_in_values.alpha_point);
	let alpha = ecurve.Point.decodeFrom(curve, alpha_buffer);

	//get user's phone as identifier for registering or retrieving key 
	let phone = OPRF_in_values.phone;

	//try to get user's key from database using phone number
	let result = await container.items.query(`SELECT container.key FROM container WHERE container.phone = ('${phone}')`).fetchAll();

	//check if user is registering or authenticating, and if user exists
	if (registration && result.resources.length == 0){

			//generate random int as server-side blinding factor
			let k = BigI(randomInt(1, Number(curve.n.toString())).toString());

			//store phone, hashed blinding factor in database
			await container.items.create({ phone: phone, key: k.toHex() });
			
			//get beta value by raising point to k
			let beta_point = alpha.multiply(k);
			
			//get beta point values
			let OPRF_out = {'beta_point': beta_point.getEncoded()};
			
			//return beta point coordinates to client
			return OPRF_out;

	}else if (!registration && result.resources.length != 0){

			//get beta value by raising point to key
			let key = BigI.fromHex(result.resources[0].key);
			let beta_point = alpha.multiply(key);

			//get beta point
			let OPRF_out = {'beta_point': beta_point.getEncoded()};

			return OPRF_out;

	}else{

			return {'beta_point': 'None'};

		}
}

async function deleteUser(container, data){

	//get data from user to confirm identity
	let phone = JSON.parse(data).phone;

	//try to get user's id and hashed key value from database using phone number
	let result = await container.items.query(`SELECT container.id FROM container WHERE container.phone = ('${phone}')`).fetchAll();

	if (result.resources.length != 0){
		
		//delete record from database
		await container.item(result.resources[0].id, phone).delete();

		return true;

	}else{

		return false;

	}
}

function initializeDBContext(client, databaseID, containerID){

	//partition key for container
    const partitionKey = {kind: 'Hash', paths: ['/phone']};
    
    //create or get database
    console.log('Checking for database...');

    client.databases.createIfNotExists({
        id: databaseID
    });

	console.log('Done')

    //create or get container
    console.log('Checking for container...');

    client.database(databaseID).containers.createIfNotExists(
        {id: containerID, partitionKey},
        {offerThroughput: 400}
    );

    console.log('Done');

}