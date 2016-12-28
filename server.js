/*
This file is part of RPGsheets.

RPGsheets is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

RPGsheets is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with RPGsheets.  If not, see <http://www.gnu.org/licenses/>.
*/

var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

var globalDB;

var insertDocument = function(collection,data, callback) {
	globalDB.collection(collection).insertOne( data, function(err, results) {
		callback(err,results);
	});
};

var queryDocument = function(collection, query, callback) {
	globalDB.collection(collection).find(query).toArray(function(err,docs){
		callback(err, docs);
	});
};

var removeDocument = function(collection, query, callback) {
	globalDB.collection(collection).deleteOne(query, function(err, results) {
		callback(err,results);
	});
};

var updateDocument = function(collection, query, data, callback) {
	globalDB.collection(collection).updateOne(query,
		{
			$set: data,
			$currentDate: { "lastModified": true }
		}, function(err, results) {
		callback(err,results);
	});
};

var APIRequestHandler = function(method,collection,
								 getCallback,getData,
								 postCallback,postData,
								 deleteCallback,deleteData,
								 updateCallback,updateData,updateQuery){
	switch(method) {
		case 'GET':
			queryDocument(collection,getData ,getCallback);
		break;
		case 'POST':
			insertDocument(collection,postData,postCallback);
		break;
		case 'DELETE':
			removeDocument(collection,deleteData, deleteCallback);
		break;
		case 'PATCH':
			updateDocument(collection,updateQuery,updateData,updateCallback);
		break;
	};
};

var APIHandler = function(method,collection,query,jsonData,response){
	APIRequestHandler(method,collection,(err,getDocs)=>{
											response.statusCode = 200;
											response.end(JSON.stringify(getDocs));
										},query,
										(err,postResults)=>{
											if(postResults.ok) {
												response.statusCode = 201;
											} else {
												response.statusCode = 204;
											}
											response.end(JSON.stringify(postResults));
										},jsonData.post,
										(err,deleteResults) =>{
											response.statusCode = 200;
											response.end(JSON.stringify(deleteResults));
										},query,
										(err,updateResults) =>{
											response.statusCode = 200;
											response.end(JSON.stringify(updateResults));
										},jsonData.post,jsonData.query);
};

var PageHandler = function(statusCode,response, filename, DataHandler){
	response.statusCode = statusCode;
	switch(statusCode){
		case 200:
			fs.readFile(filename, 'utf8', (err, data) => {
				if(!err){
					if(DataHandler) {
						data = DataHandler(data);
					}
					response.end(data);
				} else {
					if(err.code === "ENOENT") {
						PageHandler(404,response); //TODO: possivel loop aqui	
					} else {
						PageHandler(500,response); //TODO: possivel loop aqui	
					}
				}
			});
		break;
		case 404:
			response.end('<!DOCTYPE html><html><head><meta charset="UTF-8">\ 
				<title>404 Not Found</title></head><body><h1>Not Found</h1></body></html>');
		break;
		case 500:
			response.end('<!DOCTYPE html><html><head><meta charset="UTF-8">\ 
				<title>500 Internal Server Error</title></head><body><h1>Internal Server Error</h1></body></html>');
		break;
		default:
		break;
	}
};

var RequestHandler =  function(request, response){
	var method = request.method;
	var requestUrl = url.parse(request.url,true);
	var headers = request.headers;
	var requestData = '';
	request.on('data', function (chunk) {
		requestData += chunk;
	});
	request.on('end',()=>{
		var jsonData = "";
		if(requestData){
			jsonData = JSON.parse(requestData);
		}
		console.log(method + " " +requestUrl.pathname);

		var publicUrlRegex = /\/public\/([\/-z])+(.png|.css|.js|.html)/g;
		if(publicUrlRegex.test(requestUrl.pathname)){;
			var imageUrlRegx = /.png/g;
			var cssUrlRegx = /.css/g;
			var jsUrlRegx = /.js/g;
			if(imageUrlRegx.test(requestUrl.pathname)) {
				response.setHeader('Content-Type', 'image/png');
			} else if(imageUrlRegx.test(requestUrl.pathname)) {
				response.setHeader('Content-Type', 'text/css');
			} else if(imageUrlRegx.test(requestUrl.pathname)) {
				response.setHeader('Content-Type', 'application/javascript');
			} else {
				response.setHeader('Content-Type', 'text/html');
			}

			var filePath = "."+requestUrl.pathname;
			PageHandler(200,response,filePath);
		} else {
			switch(requestUrl.pathname){
				case '/':
					response.setHeader('Content-Type', 'text/html');
					var filePath = "./index.html";
					queryDocument("worlds",{} ,(err, docs)=>{
						if(!err){
							docs.map((doc)=>{
								doc.url = "http://localhost:8080/"+doc.name;
							});
							PageHandler(200,response,filePath,(page) => {
								return page.replace(/<SERVER_REPLACE_WORLDS>/g,JSON.stringify(docs));
							});	
						} else {
							PageHandler(404,response);
						}
					});
				break;
				case '/api/player':
					response.setHeader('Content-Type', 'application/json');
					APIHandler(method,"players",requestUrl.query,jsonData,response);
				break;
				case '/api/world':
					response.setHeader('Content-Type', 'application/json');
					APIHandler(method,"worlds",requestUrl.query,jsonData,response);
				break;
				case '/api/feature':
					response.setHeader('Content-Type', 'application/json');
					APIHandler(method,"features",requestUrl.query,jsonData,response);
				break;
				default:
					response.setHeader('Content-Type', 'text/html');
					var urlParts = requestUrl.pathname.split(path.sep);

					var worldName = urlParts[1];
					var playerName = urlParts[2];

					queryDocument('worlds',{"name":worldName},(err,docs)=>{
						if(docs.length) {
							if(playerName){
								var filePath = "./player.html";
								queryDocument('players',{"name":playerName,"world":worldName},(err,doc)=>{
									if(docs.length) {
										if(!err) {
											PageHandler(200,response,filePath,(page)=>{
												return page.replace(/<SERVER_REPLACE_PLAYER>/g,JSON.stringify(doc[0]));
											});
										} else {
											PageHandler(404,response);	
										}
									}else{
										PageHandler(404,response);
									}
								});
							} else {
								var filePath = "./world.html";
								queryDocument("players",{"world":worldName} ,(err,docs)=>{
									if(!err) {
										docs.map((doc)=>{
											doc.url = "http://localhost:8080/"+worldName+"/"+doc.name;
										});
										PageHandler(200,response,filePath,(page)=>{
											return page.replace(/<SERVER_REPLACE_PLAYERS>/g,JSON.stringify(docs));
										});
									} else {
										PageHandler(404,response);	
									}
								});
							}
						} else {
							PageHandler(404,response);
						}
					});
				break;
			}
		}
	});
};


var urlMongodb = 'mongodb://localhost:27017/rpgsheets';
MongoClient.connect(urlMongodb, function(err, db) {
	assert.equal(null, err);
	console.log("Connected correctly to database.");
	globalDB = db;
});

var server = http.createServer(RequestHandler);

server.listen(8080);
