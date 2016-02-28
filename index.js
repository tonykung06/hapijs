'use strict';

const Hapi = require('hapi');
const Joi = require('joi');
const Path = require('path');
const goodProcessMonitor = require('good');
const goodConsoleReporter = require('good-console');
const Boom = require('boom');
const inert = require('inert');
const vision = require('vision');
const handlebars = require('handlebars');

const server = new Hapi.Server();

server.connection({
	host: 'localhost',
	port: 8000
});

server.register([inert, vision, {
	register: goodProcessMonitor,
	options: {
		reporters: [{
			reporter: goodConsoleReporter,
			events: {
				log: '*',
				// log: ['error', 'info'],
				response: '*'
			}
		}]
	}
}], err => {
	//routes are evaluated from the most specific to least specific,
	//	so the order of routes created does not affect the order the routes are evaluated
	server.route({
		method: 'GET',
		path: '/hapi.png',
		handler: (request, reply) => {
			const path = Path.join(__dirname, 'public/hapi.png');
			reply.file(path); //file() method is added by the inert plugin
		}
	});

	server.route({
		method: 'GET',
		path: '/customFileHandler.png',
		handler: {
			file: Path.join(__dirname, 'public/hapi.png')
		}
	});

	//catch all un-matched routes to look up a file in public dir
	server.route({
		method: 'GET',
		path: '/{params*}',
		handler: {
			directory: {
				path: Path.join(__dirname, 'public')
			}
		}
	});

	//configure how to handle cookie
	//	hapi will encode and decode accordingly
	server.state('test', {
		ttl: 60 * 60 * 1000,
		isHttpOnly: true,
		encoding: 'iron',
		password: 'longrandomvalue32charactersrequired'
	});

	server.route({
		method: 'GET',
		path: '/',
		handler: (request, reply) => {
			server.log('error', 'Oh no!');
			server.log('info', 'replying...');
			server.log('info', request.state); //hapi automatically parse and decode if needed the cookie header, and populate it to state object
			reply('Hello Hapi' + JSON.stringify(request.state))
				.code(418)
				.type('text/plain')
				.header('hello', 'world')
				.state('test', 'refreshedValue')
				.state('jsoncookiekey', {
					name: 'tony'
				}); //set cookie; json object should be serialized and deserialized automatically?
			// server.log('info', responseObj.statusCode);
			// server.log('info', responseObj.headers);

			// reply(<error>, <payload>);
			// reply({hello: 'hapi'}); //the response content-type automatically becomes application/json
			// reply(Promise.resolve('hello')); //will wait for promise to resolve or reject, then serve the result or error
			// reply(require('fs').createReadStream(__filename));//can handle stream and clean up
			// reply(new Error('oops')); //HTTP 500 error
			// reply(Boom.notFound()); //by default, hapi responds json output for errors
			// reply(Boom.badRequest());
		}
	});

	server.route({
		method: 'GET',
		path: '/users/{userId?}', //? means optional
		handler: (request, reply) => {
			reply(request.params);
		}
	});

	server.route({
		method: ['POST', 'PUT'],
		path: '/users/{userId?}', //? means optional
		config: {
			validate: {
				params: Joi.object({
					userId: Joi.number()
				}),
				payload: Joi.object({
					id: Joi.number(), //be default, any payload keys not mentioned here will be disallowed
					email: Joi.string()
				})
				.unknown() //this will allow payload keys that are not mentioned in the validation
			},
			handler: (request, reply) => {
				reply({
					params: request.params,
					query: request.query,
					payload: request.payload
				});
			}
		}
	});

	server.route({
		method: 'GET',
		path: '/users/{userId}/files',
		handler: (request, reply) => {
			reply('third route matched ' + JSON.stringify(request.params));
		}
	});

	server.route({
		method: 'GET',
		path: '/files/{file}.jpg',
		handler: (request, reply) => {
			reply('forth route matched ' + JSON.stringify(request.params));
		}
	});

	server.route({
		method: 'GET',
		path: '/files/{files*}',
		handler: (request, reply) => {
			reply('fifth route matched ' + JSON.stringify(request.params));
		}
	});

	server.route({
		method: 'GET',
		path: '/files/{files*2}',
		handler: (request, reply) => {
			reply('sixth route matched ' + JSON.stringify(request.params));
		}
	});

	server.views({ //views() is added by vision
		engines: { //mapping file extensions to view engines
			hbs: handlebars
		},
		layout: true,
		relativeTo: __dirname,
		path: 'views'
	});

	server.route({
		method: 'GET',
		path: '/rendering/{name?}',
		handler: (request, reply) => {
			reply.view('home', {
				name: request.params.name || 'World'
			}); //vision adds a view method to reply object
		}
	});

	server.route({
		method: ['POST', 'PUT'],
		path: '/',
		config: {
			payload: {
				output: 'data', //default
				parse: true, //default
				allow: 'application/json'				             
			}
		},
		handler: (request, reply) => {
			server.log('info', request.payload);
			reply(request.payload);
		}
	});

	//Extending the request with lifecycle events
	//	for manipulating the request and response
	server.ext('onRequest', (request, reply) => {
		console.log('onRequest');
		// request.setUrl('/'); //all requests will be changed to /
		// request.setMethod('GET');
		reply.continue(); //this is required to have the request continue, otherwise the request is stuck and no response to the client
	});

	server.ext('onPreAuth', (request, reply) => {
		console.log('onPreAuth');
		reply.continue(); //this is required to have the request continue, otherwise the request is stuck and no response to the client
	});

	server.ext('onPostAuth', (request, reply) => {
		console.log('onPostAuth');
		reply.continue(); //this is required to have the request continue, otherwise the request is stuck and no response to the client
	});

	server.ext('onPreHandler', (request, reply) => {
		console.log('onPreHandler');
		reply.continue(); //this is required to have the request continue, otherwise the request is stuck and no response to the client
	});

	server.ext('onPostHandler', (request, reply) => {
		console.log('onPostHandler');
		reply.continue(); //this is required to have the request continue, otherwise the request is stuck and no response to the client
	});

	server.ext('onPreResponse', (request, reply) => {
		console.log('onPreResponse');

		//by default, all error resopnse is in json format, 
		//	need to change to hbs html response
		let response = request.response; //the response property contains details about how the route handler replys to the reqeust
		                                 //	hapi wil automatically convert the response to Boom object in error cases
        if (!response.isBoom) {
			return reply.continue(); //this is required to have the request continue, otherwise the request is stuck and no response to the client
        }

        reply.view('error', response.output.payload).code(response.output.statusCode); //error payload: status code and error message
	});

	server.start(() => {
		console.log(`Started at: ${server.info.uri}`);
	});
});
