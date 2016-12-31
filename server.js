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
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var router = require('./router.js');

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

var RoutePublic = function(request, response, data, PageHandler) {
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
			PageHandler(200,response,filePath);	
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
	collection = "worlds";
	response.setHeader('Content-Type', 'application/json');
	var requestUrl = url.parse(request.url,true);
	switch(request.method) {
		case 'GET':
			queryDocument(collection,requestUrl.query ,(err,getDocs)=>{
														response.statusCode = 200;
														response.end(JSON.stringify(getDocs));
													});
		break;
		case 'POST':
			insertDocument(collection,data.post,(err,postResults)=>{
													response.statusCode = 201;
													response.end(JSON.stringify(postResults));
												});
		break;
		case 'DELETE':
			console.log(data);
			removeDocument(collection,data.query, (err,deleteResults) =>{
															response.statusCode = 200;
															response.end(JSON.stringify(deleteResults));
														});
		break;
		case 'PATCH':
			updateDocument(collection,data.query,data.post,(err,updateResults) =>{
															response.statusCode = 200;
															response.end(JSON.stringify(updateResults));
														});
		break;
	};
};

var RouteApiPlayer = function(request, response, data, PageHandler) {
	collection = "players";
	response.setHeader('Content-Type', 'application/json');
	var requestUrl = url.parse(request.url,true);
	switch(request.method) {
		case 'GET':
			queryDocument(collection,requestUrl.query ,(err,getDocs)=>{
														response.statusCode = 200;
														response.end(JSON.stringify(getDocs));
													});
		break;
		case 'POST':
			insertDocument(collection,data.post,(err,postResults)=>{
													response.statusCode = 201;
													response.end(JSON.stringify(postResults));
												});
		break;
		case 'DELETE':
			console.log(data);
			removeDocument(collection,data.query, (err,deleteResults) =>{
															response.statusCode = 200;
															response.end(JSON.stringify(deleteResults));
														});
		break;
		case 'PATCH':
			updateDocument(collection,data.query,data.post,(err,updateResults) =>{
															response.statusCode = 200;
															response.end(JSON.stringify(updateResults));
														});
		break;
	};
};

var RouteApiFeature = function(request, response, data, PageHandler) {
	collection = "features";
	response.setHeader('Content-Type', 'application/json');
	var requestUrl = url.parse(request.url,true);
	switch(request.method) {
		case 'GET':
			queryDocument(collection,requestUrl.query ,(err,getDocs)=>{
														response.statusCode = 200;
														response.end(JSON.stringify(getDocs));
													});
		break;
		case 'POST':
			insertDocument(collection,data.post,(err,postResults)=>{
													response.statusCode = 201;
													response.end(JSON.stringify(postResults));
												});
		break;
		case 'DELETE':
			console.log(data);
			removeDocument(collection,data.query, (err,deleteResults) =>{
															response.statusCode = 200;
															response.end(JSON.stringify(deleteResults));
														});
		break;
		case 'PATCH':
			updateDocument(collection,data.query,data.post,(err,updateResults) =>{
															response.statusCode = 200;
															response.end(JSON.stringify(updateResults));
														});
		break;
	};
};

var urlMongodb = 'mongodb://localhost:27017/rpgsheets';
MongoClient.connect(urlMongodb, function(err, db) {
	assert.equal(null, err);
	console.log("Connected correctly to database.");
	globalDB = db;
});

var server = http.createServer(router.RequestHandler);

router.add(/^\/$/,RouteIndex);
router.add(/^\/\w+$/,RouteWorld);
router.add(/^\/(?!(api))\w+\/\w+$/,RoutePlayer);
router.add(/^\/api\/feature$/,RouteApiFeature);
router.add(/^\/api\/world$/,RouteApiWorld);
router.add(/^\/api\/player$/,RouteApiPlayer);
router.add(/^\/public\/[(\--z)]+(.png|.css|.js|.html)$/,RoutePublic);

server.listen(8080);
