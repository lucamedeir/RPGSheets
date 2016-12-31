var fs = require('fs');
var url = require('url');

var globalRoutes = [];

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

exports.RequestHandler =  function(request, response){
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
							if(item.url.test(requestUrl.pathname)) {
								item.route(request,response,data,RequestPageHandler);
								return false;
							} else return true;

						 });
		if(isNotFound) {
			RequestPageHandler(404,response);
		}
	});
};


exports.add =  function(url,routeFunction) {
	globalRoutes.push({"url":url,"route":routeFunction});
};