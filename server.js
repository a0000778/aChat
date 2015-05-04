/*
聊天室子程序
處理使用者的請求
*/
var Http=require('http');
var Https=require('https');
var WebSocket=require('websocket');
var Channel=require('./Channel.js');
var Config=require('./Config.js');
var DB=require('./DB.js');
var User=require('./User.js');

process.title='aChat - 聊天室伺服器';
console.log('aChat v2.0.0 by a0000778');
console.log('MIT Licence');

var serverLock=false;
if(Config.ssl)
	var web=Https.createServer(Config.ssl);
else
	var web=Http.createServer();
var socket=new WebSocket.server();

web.on('request',require('./http.js'));
web.on('close',function(){
	User.exit(1001);
});
socket.mount({
	'httpServer': web
});

socket.on('request',function(req){
	if(req.requestedProtocols.indexOf('adminv1')>=0){
		//轉接至管理指令
		return;
	}
	if(serverLock){
		req.reject(4001,'Server locked.');
		return;
	}
	if(User.userList.length>=Config.userMax){
		req.reject(4002,'Server overload.');
		return;
	}
	if(req.requestedProtocols.indexOf('chatv1')>=0)
		new User(req.accept('chatv1',req.origin));
	else
		req.reject(404,'Not supported protocol.');
});

console.log('載入頻道列表...');
DB.getAllChannel(function(error,result){
	if(error){
		console.log('頻道列表載入失敗');
		process.exit();
	}
	result.forEach(function(channel){
		new Channel(channel.channelId,channel.name);
	});
	if(!Channel.findById(Config.channelDefault)){
		console.log('預設頻道不存在！');
		process.exit();
	}
	console.log('頻道列表載入完畢！共計 %d 個頻道',result.length);
	console.log('啟動伺服器...');
	web.listen(Config.port,function(e){
		if(e){
			console.log('伺服器啟動失敗');
			console.log(e);
			process.exit();
		}else{
			console.log('伺服器已啟動');
			process.once('SIGINT',function(){
				process.on('SIGINT',function(){
					console.log('伺服器關閉中，請稍後');
				});
				serverLock=true;
				User.exit(1001);
				web.close();
				DB.writeChatLogNow(true);
				setInterval(function(){
					if(!DB.chatLogCacheCount())
						process.exit();
					console.log('等待聊天記錄完全寫出...')
				},1000);
			});
		}
	});
});

if(Config.debug)
	setInterval(function(){
		var ram=process.memoryUsage();
		console.log(
			'在線: %d, RAM: %d KB, 聊天記錄快取: %d',
			User.userList.length,
			Math.floor(ram.rss/1024),
			DB.chatLogCacheCount()
		);
	},1000);