'use strict';
var Base=require('./Base.js');
var channel=require('../channel.js');
var config=require('../config.js')
var db=require('../db.js');
var createUpdateEmail=require('../http.js').createUpdateEmail;
var user=require('../user.js');
var util=require('util');

var quota_sendMsg=15;		//限制每20秒發訊息次數，超過限制則懲罰20~40秒內無法發言

/* 一般指令組 */
function Normal(user){
	Base.call(this,user);
	this._quota_sendMsg=quota_sendMsg;
	this._quotaResetInterval=setInterval(this._quotaReset,20000,this);
	
	channel.findById(config.channelDefault).join(user,true);//進入預設頻道，無視頻道人數上限
}
util.inherits(Normal,Base);
Normal.prototype.channel_list=function(data,link,list){
	link.send({
		'action': 'channel_list',
		'list': list? list:Base.makeChannelList()
	});
}
Normal.prototype.channel_switch=function(data,link){
	if(!(Number.isSafeInteger(data.channelId) && data.channelId>0)) return;
	let ch=channel.findById(data.channelId);
	if(ch){
		if(ch.join(this._user)){
			this._user.send({
				'action': 'channel_switch',
				'status': 'success',
				'channelId': data.channelId
			});
		}else{
			link.send({
				'action': 'channel_switch',
				'status': 'full',
				'channelId': data.channelId
			});
		}
	}else{
		link.send({
			'action': 'channel_switch',
			'status': 'not exists',
			'channelId': data.channelId
		});
	}
}
Normal.prototype.channel_userList=function(data,link,channelId,list){
	let ch,userList;
	if(data.hasOwnProperty('channelId')){
		if(!(Number.isSafeInteger(data.channelId) && data.channelId>0)) return;
		ch=channel.findById(data.channelId);
		if(!ch){
			link.send({
				'action': 'channel_userList',
				'status': 'not exists'
			});
			return;
		}
	}else{
		ch=this._user.channel;
		userList=[];
		for(let u of ch.list())
			userList.push(u.userId);
	}
	link.send({
		'action': 'channel_userList',
		'status': 'success',
		'channelId': channelId || ch.channelId,
		'userList': list || userList
	});
}
Normal.prototype.chat_normal=function(data,link){
	if(!(typeof(data.msg)==='string' && data.msg.length)) return;
	if(!this._user.channel) return;
	let time=new Date();
	if(this._quota_sendMsg<=0){
		link.send({
			'action': 'chat_notice',
			'msg': '超過每20秒發言頻率上限，請稍候再試。',
			'time': time
		});
		this._quota_sendMsg-=quota_sendMsg;
		return;
	}
	this._quota_sendMsg--;
	this._user.channel.send({
		'action': 'chat_normal',
		'fromUserId': this._user.userId,
		'msg': data.msg,
		'time': time.getTime()
	});
	db.writeChatLog(time,0,this._user.channel.channelId,this._user.userId,null,data.msg);
}
Normal.prototype.chat_private=function(data,link){
	if(!(
		Number.isSafeInteger(data.toUserId) && data.toUserId>0 && 
		typeof(data.msg)==='string' && data.msg.length
	)) return;
	var target=user.findUser('userId',data.toUserId);
	if(target){
		let time=new Date();
		if(this._quota_sendMsg<=0){
			link.send({
				'action': 'chat_notice',
				'msg': '超過每20秒發言頻率上限，請稍候再試。',
				'time': time
			});
			this._quota_sendMsg-=quota_sendMsg;
			return;
		}
		this._quota_sendMsg--;
		let sendData=JSON.stringify({
			'action': 'chat_private',
			'fromUserId': this._user.userId,
			'toUserId': data.toUserId,
			'msg': data.msg,
			'time': time.getTime()
		});
		target.send(sendData);
		this._user.send(sendData);
		db.writeChatLog(time,1,null,this._user.userId,target.userId,data.msg);
	}else{
		this._user.send({
			'action': 'chat_private',
			'error': 'offline or not exists',
			'toUserId': data.toUserId
		});
	}
}
Normal.prototype.user_getProfile=function(data,link){
	if(!(
		Array.isArray(data.userIds) && 
		data.userIds.every(function(userId){
			return Number.isSafeInteger(userId) && userId>0
		})
	)) return;
	var _=this;
	data.userIds.forEach(function(userId){
		user.getProfile(userId,function(result){
			if(result===null){
				link.send({
					'action': 'user_getProfile',
					'status': 'fail',
					'profile': {'userId': userId}
				});
			}else if(userId===_._user.userId){
				link.send({
					'action': 'user_getProfile',
					'status': 'success',
					'profile': {
						'userId': result.userId,
						'username': result.username,
						'email': result.email,
						'regTime': result.regTime.getTime()
					}
				});
			}else{
				link.send({
					'action': 'user_getProfile',
					'status': 'success',
					'profile': {
						'userId': result.userId,
						'username': result.username,
						'regTime': result.regTime.getTime()
					}
				});
			}
		});
	});
}
Normal.prototype.user_editProfile=function(data,link){
	if(!(
		link._question && 
		data.hasOwnProperty('answer') && (data.answer=Base.toBuffer(data.answer)) && user.fieldCheck.answer(data.answer)
	)) return;
	var userData={}
	for(let field in data){
		if(field=='action' || field=='answer')
			continue;
		else if(field=='password' && (userData.password=Base.toBuffer(data.password)) && user.fieldCheck.password(userData.password))
			continue;
		else if(field=='email' && user.fieldCheck.email(data.email)){
			userData.email=data.email;
			continue;
		}else return;
	}
	var _=this;
	user.authByPassword(this._user.username,link._question,data.answer,function(result){
		if(result=='disabled')
			_._user.exit(4101);
		else if(result=='fail')
			link.send({
				'action': 'user_editProfile',
				'status': 'auth fail'
			});
		else{
			if(userData.hasOwnProperty('email')){
				createUpdateEmail(_._user.userId,_._user.username,userData.email);
				delete userData.email;
			}
			if(Object.keys(userData).length)
				user.updateProfile(_._user.userId,userData,function(){
					link.send({
						'action': 'user_editProfile',
						'status': 'success'
					});
				});
			else
				link.send({
					'action': 'user_editProfile',
					'status': 'success'
				});
		}
	});
}
Normal.prototype.user_listSession=function(data,link){
	var u=this._user;
	user.getSession(this._user.userId,function(result){
		for(let sess of result){
			sess.online=!!u.findSession(sess.session);
			sess.session=sess.session.toString('hex');
		}
		link.send({
			'action': 'user_listSession',
			'sessions': result
		});
	});
}
Normal.prototype.user_logout=function(data,link){
	link.removeSession=true;
	link.exit();
}
Normal.prototype.user_removeSession=function(data,link){
	if(!(data.hasOwnProperty('session') && (data.session=Base.toBuffer(data.session)) && user.fieldCheck.session(data.session)))
		return;
	if(Buffer.compare(link.session,data.session))
		user.removeSession(data.session,function(){
			let sess=this._user.findSession(data.session.toString('hex'));
			if(sess) sess.exit(4105);
			link.send({
				'action': 'user_removeSession',
				'session': data.session.toString('hex'),
				'status': 'removed'
			});
		});
	else
		link.send({
			'action': 'user_removeSession',
			'session': data.session.toString('hex'),
			'status': 'now session'
		});
		
}
Normal.prototype._quotaReset=function(_){
	_._quota_sendMsg=Math.min(_._quota_sendMsg+quota_sendMsg,quota_sendMsg);
}
Normal.prototype._umount=function(){
	clearInterval(this._quotaResetInterval);
	Base.prototype._umount.call(this);
}

module.exports=Normal;
