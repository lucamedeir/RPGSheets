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
var globalRoutes = [];

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
	response.setHeader('Content-Type', 'application/json');
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

var RequestPageHandler = function(statusCode,response, filename, DataHandler){
	response.statusCode = statusCode;
	switch(statusCode){
		case 200:
			if(DataHandler) {
				fs.readFile(filename, 'utf8', (err, data) => {
					if(!err){
						data = DataHandler(data);
						response.end(data);
					} else {
						if(err.code === "ENOENT") {
							RequestPageHandler(404,response);
						} else {
							RequestPageHandler(500,response);
						}
					}
				});
			} else {
				fs.readFile(filename, (err, data) => {
					console.log(err);
					if(!err){
						response.end(data);
					} else {
						if(err.code === "ENOENT") {
							RequestPageHandler(404,response);
						} else {
							RequestPageHandler(500,response);
						}
					}
				});
			}

		break;
		case 404:
			response.setHeader('Content-Type', 'text/html');
			response.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404 Not Found</title></head><body><h1>Not Found</h1></body></html>');
		break;
		case 500:
			response.setHeader('Content-Type', 'text/html');
			response.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>500 Internal Server Error</title></head><body><h1>Internal Server Error</h1></body></html>');
		break;
		default:
		break;
	}
};

var RoutePublic = function(request, response, data,PageHandler) {
	var requestUrl = url.parse(request.url,true);
	var pathname = requestUrl.pathname;
	var imageUrlRegx = /.png/g;
	var cssUrlRegx = /.css/g;
	var jsUrlRegx = /.js/g;
	if(imageUrlRegx.test(pathname)) {
		response.setHeader('Content-Type', 'image/png');
	} else if(imageUrlRegx.test(pathname)) {
		response.setHeader('Content-Type', 'text/css');
	} else if(imageUrlRegx.test(pathname)) {
		response.setHeader('Content-Type', 'application/javascript');
	} else {
		response.setHeader('Content-Type', 'text/html');
	}

	var filePath = "."+pathname;
	PageHandler(200,response,filePath);
};

var RouteIndex = function(request,response,data,PageHandler) {
	response.setHeader('Content-Type', 'text/html');
	var filePath = "./index.html";
	queryDocument("worlds",{} ,(err, docs)=>{
		if(!err){
			PageHandler(200,response,filePath,(page) => {
				docs.map((doc)=>{
					doc.url = "http://localhost:8080/"+doc.name;
				});
				return page.replace(/<SERVER_REPLACE_WORLDS>/g,JSON.stringify(docs));
			});	
		} else {
			PageHandler(404,response);
		}
	});
};

var RouteWorld = function(request,response,data,PageHandler) {
	var requestUrl = url.parse(request.url,true);
	response.setHeader('Content-Type', 'text/html');
	var urlParts = requestUrl.pathname.split(path.sep);

	var worldName = urlParts[1];

	var filePath = "./world.html";
	queryDocument('worlds',{"name":worldName},(err,worldDocs)=>{
		if(!err) {
			if(worldDocs.length) {
				queryDocument("players",{"world":worldName} ,(err,playerDocs)=>{
					if(!err) {
						PageHandler(200,response,filePath,(page)=>{
							playerDocs.map((player)=>{
								player.url = "http://localhost:8080/"+worldName+"/"+player.name;
							});
							return page.replace(/<SERVER_REPLACE_PLAYERS>/g,JSON.stringify(playerDocs));
						});
					} else {
						PageHandler(500,response);	
					}
				});
			} else {
				PageHandler(404,response);
			}
		} else {
			PageHandler(500,response);
		}
	});

};

var RoutePlayer = function(request,response,data,PageHandler) {
	var requestUrl = url.parse(request.url,true);
	response.setHeader('Content-Type', 'text/html');
	var urlParts = requestUrl.pathname.split(path.sep);

	var worldName = urlParts[1];
	var playerName = urlParts[2];

	queryDocument('worlds',{"name":worldName},(err,worldDocs)=>{
		if(!err) {
			if(worldDocs.length) {
				var filePath = "./player.html";
				queryDocument('players',{"name":playerName,"world":worldName},(err,playerDocs)=>{
					if(!err) {
						if(playerDocs.length){
							PageHandler(200,response,filePath,(page)=>{
								return page.replace(/<SERVER_REPLACE_PLAYER>/g,JSON.stringify(playerDocs[0]));
							});
						} else {
							PageHandler(404,response);
						}
					}else{
						PageHandler(500,response);
					}
				});
			} else {
				PageHandler(404,response);
			}
		} else {
			PageHandler(500,response);
		}

	});
};

var RouteApiWorld = function(request, response, data, PageHandler) {
	var requestUrl = url.parse(request.url,true);
	APIHandler(request.method,"worlds",requestUrl.query,data,response);
};

var RouteApiPlayer = function(request, response, data, PageHandler) {
	var requestUrl = url.parse(request.url,true);
	APIHandler(request.method,"players",requestUrl.query,data,response);
};

var RouteApiFeature = function(request, response, data, PageHandler) {
	var requestUrl = url.parse(request.url,true);
	APIHandler(request.method,"features",requestUrl.query,data,response);
};

var RequestHandler =  function(request, response){
	var requestUrl = url.parse(request.url,true);
	var requestData = '';
	request.on('data', function (chunk) {
		requestData += chunk;
	});
	request.on('end',()=>{
		var data = "";
		if(requestData){
			data = JSON.parse(requestData);
		}
		console.log(request.method + " [" +requestUrl.pathname+"]");

		var isNotFound = globalRoutes.every((item,index)=>{
							console.log(item);
							if(item.url.test(requestUrl.pathname)) {
								console.log(requestUrl.pathname);
								item.route(request,response,data,RequestPageHandler);
								return false;
							} else return true;

						 });
		if(isNotFound) {
			RequestPageHandler(404,response);
		}
	});
};


var urlMongodb = 'mongodb://localhost:27017/rpgsheets';
MongoClient.connect(urlMongodb, function(err, db) {
	assert.equal(null, err);
	console.log("Connected correctly to database.");
	globalDB = db;
});


globalRoutes.push({"url":/^\/$/,"route":RouteIndex});
globalRoutes.push({"url":/^\/\w+$/,"route":RouteWorld});
globalRoutes.push({"url":/^\/(?!(api))\w+\/\w+$/,"route":RoutePlayer});
globalRoutes.push({"url":/^\/api\/feature$/,"route":RouteApiFeature});
globalRoutes.push({"url":/^\/api\/world$/,"route":RouteApiWorld});
globalRoutes.push({"url":/^\/api\/player$/,"route":RouteApiPlayer});
globalRoutes.push({"url":/^\/public\/\w+(.png|.css|.js|.html)$/,"route":RoutePublic});

var server = http.createServer(RequestHandler);

server.listen(8080);
