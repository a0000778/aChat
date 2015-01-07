var WSClient=require('websocket').client;
var Account=require('./test_account.js');
const startCount=5000;//測試次數

var clientList=[];
var connectStart=0;
var connectClose=0;
var connectFail=0;
var connectSuccess=0;
var connectGet=0;
var connectSend=0;
var autoConnect=setInterval(function(){
	connect();
	if(clientList.length<startCount) return;
	console.log('已發起 %d 次連線，等待自動登出',startCount);
	clearInterval(autoConnect);
},70);
var monitor=setInterval(function(){
	console.log(
		'連線: %d, 收到: %d, 送出: %d, 發起: %d, 成功: %d, 失敗: %d, 關閉: %d',
		clientList.length,
		connectGet,
		connectSend,
		connectStart,
		connectSuccess,
		connectFail,
		connectClose
	);
	if(clientList.length) return;
	console.log('已全數離線，關閉監控');
	clearInterval(monitor);
},1000);

function closeAll(){
	clientList.forEach(function(link){
		link.close();
	});
}
function connect(){
	var client=new WSClient();
	var account=Account.shift();

	client
		.on('connect',function(link){
			link.sendUTF(JSON.stringify({
				'action': 'auth',
				'username': account.username,
				'password': account.password
			}));
			mountOutput(link,account);
			clientList.push(link);
			connectSuccess++;
		})
		.on('connectFailed',function(msg){
			console.log('嘗試發起連線失敗，原因：%s',msg);
			connectFail++;
		})
	;
	connectStart++;
	client.connect(
		'ws://localhost:8080/',
		'chatv1'
	);
}
function makeFakeChat(link){
	if(!link.connected) return;
	connectSend++;
	link.sendUTF(JSON.stringify({
		'action': 'chat_normal',
		'msg': 'test message at time '+new Date().toLocaleTimeString()
	}));
	setTimeout(makeFakeChat,Math.floor(Math.random()*9000)+1000,link);
}
function mountOutput(link,account){
	link
		.on('message',function(msg){
			if(msg.type!=='utf8'){
				console.log('not utf8!?');
				return;
			}
			msg=JSON.parse(msg.utf8Data);
			switch(msg.action){
				case 'auth':
					if(msg.status=='success'){
						link.sendUTF(JSON.stringify({'action':'channel_list'}));
					}
				break;
				case 'channel_list':
					link.sendUTF(JSON.stringify({
						'action':'channel_switch',
						'channelId': msg.list[Math.floor(Math.random()*msg.list.length)].channelId
					}));
				break;
				case 'channel_switch':
					if(['success','full'].indexOf(msg.status)!==-1){
						makeFakeChat(link);
					}else{
						console.log('[Fail] channel_switch: %s',msg.status);
						link.close();
					}
				break;
				case 'chat_normal':
					connectGet++;
					//console.log(msg.msg);
				break;
			}
		})
		.on('close',function(code,msg){
			connectClose++;
			clientList.splice(clientList.indexOf(link),1);
			Account.push(account);
			if(code!==1000) console.log('Link Closed [%d] %s',code,msg);
		})
		.on('error',function(err){
			console.log('Link Error: %s',err);
		})
	;
	setTimeout(function(){
		if(Math.floor(Math.random()*2))
			link.close();
		else
			link.sendUTF(JSON.stringify({
				'action': 'user_logout'
			}));
	},Math.floor(Math.random()*10000)+20000);
}