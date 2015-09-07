/*
壓力測試腳本
node test_client
*/
'use strict';
let WSClient=require('websocket').client;
let crypto=require('crypto');

let initedClient=0;
let users=[];
let commandInputSpeedCount=0;
let commandOutputSpeedCount=0;
let linkCount=0;
let linkFailCount=0;

console.log('載入測試帳號 ...');
for(let acc of require('./test_account.js'))
	new TestUser(acc.username,acc.password);
console.log('已載入 %d 個測試帳號',users.length);

console.log('開始測試');
let autoInitClient=setInterval(function(){
	if(initedClient<users.length)
		users[initedClient].init();
	else{
		clearInterval(autoInitClient);
		console.log('所有模擬用戶端皆已啟用');
	}
},100);
setInterval(function(){
	console.log(
		'帳號數: %d, 連線數: %d, 連線失敗: %d, 指令傳送: %d /s, 指令接收: %d /s',
		initedClient,
		linkCount,
		linkFailCount,
		commandOutputSpeedCount,
		commandInputSpeedCount
	);
	commandInputSpeedCount=0;
	commandOutputSpeedCount=0;
},1000);

function TestClient(user){
	this.user=user;
	this.link=null;
	this.session=null;
	this.pm=null;
	this.autoChatTimeout=null;
	
	let _=this;
	new WSClient()
		.on('connect',function(link){
			linkCount++;
			_.link=link
			link
				.on('message',(data) => _._parseCommand(data))
				.on('close',(code) => _._closeStatus(code))
				//.on('error',(error) => console.log('Link Error: %s',error))
			;
			_._startCommand(link);
		})
		.on('connectFailed',function(msg){
			//console.log('嘗試發起連線失敗，原因：%s',msg);
			linkFailCount++;
		})
		.connect(
			'ws://localhost:9700/',
			'chatv1'
		)
	;
}
TestClient.prototype._autoChat=function(_){
	_=_ || this;
	if(!_.session) return;
	if(_.pm){
		_._send({
			'action': 'chat_private',
			'toUserId': _.pm,
			'msg': 'test message '+Date.now()
		});
	}else{
		_._send({
			'action': 'chat_normal',
			'msg': 'test message '+Date.now()
		});
	}
		
	if(Math.floor(Math.random()*300))//模擬可能換頻道
		this.autoChatTimeout=setTimeout(_._autoChat,Math.floor(Math.random()*4000)+1500,_);
	else
		_._send({'action':'channel_list'});
}
TestClient.prototype._closeStatus=function(code){
	this.user.idleDevCount++;
	linkCount--;
	if(code!==1000)
		console.log('Close by %d',code);
	if(this.session)
		this.user.session.push(this.session);
}
TestClient.prototype._parseCommand=function(data){
	commandInputSpeedCount++;
	data=JSON.parse(data.utf8Data);
	switch(data.action){
		case 'question':
			this._send({
				'action': 'createSession',
				'username': this.user.username,
				'answer': passwordHmac(new Buffer(data.question,'hex'),new Buffer(this.user.password,'hex'))
			});
		break;
		case 'createSession':
			this.session={
				'userId': data.userId,
				'session': data.session
			};
			this._send({
				'action': 'authBySession',
				'userId': this.session.userId,
				'session': this.session.session
			});
		break;
		case 'authBySession':
			this._send({'action':'channel_list'});
		break;
		case 'channel_list':
			this._send({
				'action':'channel_switch',
				'channelId': data.list[Math.floor(Math.random()*data.list.length)].channelId
			});
		break;
		case 'channel_switch':
			if(data.status=='default' || data.status=='force') return;
			if(this.autoChatTimeout) clearTimeout(this.autoChatTimeout);
			this._autoChat();
		break;
		case 'chat_normal':
			if(!(this.pm || Math.floor(Math.random()*50)))
				this.pm=data.fromUserId;
		break;
		case 'chat_private':
			if(Math.floor(Math.random()*2))
				this.pm=data.fromUserId;
			else
				this.pm=null;
			if(!Math.floor(Math.random()*2000))
				this._send({'action': 'logout'});
			else if(!Math.floor(Math.random()*200))
				this.link.close();
		break;
	}
}
TestClient.prototype._send=function(data){
	commandOutputSpeedCount++;
	this.link.sendUTF(JSON.stringify(data));
}
TestClient.prototype._startCommand=function(){
	if(!this.user.session.length || Math.floor(Math.random()*5)===0){//假定 25% 的建立 Session 機率
		this._send({'action': 'createQuestion'});
	}else{
		this.session=this.user.session.shift();
		this._send({
			'action': 'authBySession',
			'userId': this.session.userId,
			'session': this.session.session
		});
	}
}

function TestUser(username,password){
	this.username=username;
	this.password=password;
	this.session=[];
	this.idleDevCount=Math.floor(Math.random()*4)+1;
	
	users.push(this);
}
TestUser.prototype.init=function(){
	initedClient++;
	setInterval(this.trySpawnClient,5000,this);
}
TestUser.prototype.trySpawnClient=function(_){
	_=_ || this;
	if(_.idleDevCount){
		_.idleDevCount--;
		new TestClient(_);
	}
}

function passwordHmac(question,password){
	return crypto.createHmac('sha256',password).update(question).digest('hex');
}