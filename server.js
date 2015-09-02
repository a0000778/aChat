'use strict';
var channel=require('./channel.js');
var config=require('./config.js');
var db=require('./db.js');
var http=require('http');
var https=require('https');
var aChat=require('./package.json');
var user=require('./user.js');
var webSocket=require('websocket');

process.title='aChat - 聊天室伺服器';
console.log('aChat v%s by a0000778',aChat.version);
console.log(aChat.licence);

var serverLock=false;
if(config.ssl)
	var httpServer=https.createServer(config.ssl);
else
	var httpServer=http.createServer();
var wsServer=new webSocket.server();

httpServer
	.on('request',require('./http.js').request)
	.on('close',() => user.exit(1001))
;
wsServer.mount({
	'httpServer': httpServer
});

wsServer.on('request',function(req){
	if(req.requestedProtocols.indexOf('adminv1')!==-1)
		user.createLink(req.accept('adminv1',req.origin));
	else if(serverLock)
		req.reject(4001,'Server locked.');
	else if(user.sessionCount>=config.sessionMax)
		req.reject(4002,'Server overload.');
	else if(req.requestedProtocols.indexOf('chatv1')>=0)
		user.createLink(req.accept('chatv1',req.origin));
	else
		req.reject(404,'Not supported protocol.');
});

console.log('載入頻道列表...');
channel.loadAll(function(error){
	if(error){
		console.log('頻道列表載入失敗');
		process.exit();
	}
	if(!channel.findById(config.channelDefault)){
		console.log('預設頻道不存在！');
		process.exit();
	}
	console.log('啟動伺服器...');
	httpServer.listen(config.port,function(error){
		if(error){
			console.log('伺服器啟動失敗');
			console.log(error);
			process.exit();
		}else{
			console.log('啟動完畢');
			process.once('SIGINT',function(){
				process.on('SIGINT',() => console.log('伺服器關閉中 ...'));
				serverLock=true;
				user.exit(1001);
				httpServer.close();
				db.writeChatLogNow(true);
				setInterval(function(){
					let chatLogCacheCount=db.chatLogCacheCount();
					if(!chatLogCacheCount)
						process.exit();
					console.log('等待聊天記錄完全寫出 (剩餘 %d) ...',chatLogCacheCount);
				},1000);
			});
		}
	});
});