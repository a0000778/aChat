'use strict';
var Util=require('util');
var Base=require('./Base.js');
var Channel=require('../Channel.js');
var DB=require('../DB.js');
var User=require('../User.js');
var debug=require('../Config.js').debug;

var quota_sendMsg=15;		//限制每20秒發訊息次數，超過限制則懲罰20~40秒內無法發言

/* 一般指令組 */
function Normal(user){
	Base.call(this,user);
	this._quota_sendMsg=quota_sendMsg;
	this._quotaResetInterval=setInterval(this._quotaReset,20000,this);
}
Util.inherits(Normal,Base);
Normal.prototype.channel_list=function(data,list){
	this._user.send({
		'action': 'channel_list',
		'list': list? list:Base.makeChannelList()
	});
}
Normal.prototype.channel_switch=function(data){
	if(!/^\d+$/.test(data.channelId) || data.channelId<=0) return;
	var channel=Channel.findById(data.channelId);
	if(channel){
		if(channel.join(this._user)){
			this._user.send({
				'action': 'channel_switch',
				'status': 'success',
				'channelId': data.channelId
			});
		}else{
			this._user.send({
				'action': 'channel_switch',
				'status': 'full',
				'channelId': data.channelId
			});
		}
	}else{
		this._user.send({
			'action': 'channel_switch',
			'status': 'not exists',
			'channelId': data.channelId
		});
	}
}
Normal.prototype.channel_userList=function(data,channelId,list){
	if(data.hasOwnProperty('channelId')){
		if(!/^\d+$/.test(data.channelId) && data.channelId<=0){
			var channel=Channel.findById(data.channelId);
			if(!channel){
				this._user.send({
					'action': 'channel_userList',
					'status': 'not exists'
				});
				return;
			}
		}else return;
	}else{
		var channel=this._user.channel;
	}
	this._user.send({
		'action': 'channel_userList',
		'status': 'success',
		'channelId': channelId || channel.channelId,
		'userList': list || channel.onlineList.reduce(function(list,user){
			list.push({'userId':user.userId,'username':user.username});
			return list;
		},[])
	});
}
Normal.prototype.chat_normal=function(data){
	if(!data.msg || typeof(data.msg)!='string' || !data.msg.length) return;
	if(!this._user.channel) return;
	var time=Math.floor(new Date().getTime()/1000);
	if(this._quota_sendMsg<=0){
		this._user.send({
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
		'time': time
	});
	DB.writeChatLog(time,0,this._user.channel.channelId,this._user.userId,null,data.msg);
}
Normal.prototype.chat_private=function(data){
	if(!/^\d+$/.test(data.toUserId) || data.toUserId<=0) return;
	if(!data.msg || typeof(data.msg)!='string' || !data.msg.length) return;
	var target=User.findById(data.toUserId);
	if(target){
		var time=Math.floor(new Date().getTime()/1000);
		if(this._quota_sendMsg<=0){
			this._user.send({
				'action': 'chat_notice',
				'msg': '超過每20秒發言頻率上限，請稍候再試。',
				'time': time
			});
			this._quota_sendMsg-=quota_sendMsg;
			return;
		}
		this._quota_sendMsg--;
		var sendData=JSON.stringify({
			'action': 'chat_private',
			'fromUserId': this._user.userId,
			'toUserId': data.toUserId,
			'msg': data.msg,
			'time': time
		});
		target.send(sendData);
		this._user.send(sendData);
		DB.writeChatLog(time,1,null,this._user.userId,target.userId,data.msg);
	}else{
		this._user.send({
			'action': 'chat_private',
			'error': 'offline or not exists',
			'toUserId': data.toUserId
		});
	}
}
Normal.prototype.user_getProfile=function(data){
	if(Array.isArray(data.userIds) && data.userIds.reduce(function(result,userId){
		return result && /^\d+$/.test(userId)
	},true)){
		var _=this;
		data.userIds.forEach(function(userId){
			if(userId===this._user.userId){
				this._user.profile(null,function(error,result){
					if(error || !result){
						_._user.send({
							'action': 'user_getProfile',
							'status': 'fail',
							'profile': {'userId': _._user.userId}
						});
					}else{
						_._user.send({
							'action': 'user_getProfile',
							'status': 'success',
							'profile': {
								'userId': result.userId,
								'username': result.username,
								'email': result.email,
								'regTime': result.regTime
							}
						});
					}
				});
			}else{
				var user=User.findById(userId);
				if(user){
					_._user.send({
						'action': 'user_getProfile',
						'status': 'success',
						'profile': {
							'userId': user.userId,
							'username': user.username,
							'regTime': user.regTime
						}
					});
				}else{
					_._user.send({
						'action': 'user_getProfile',
						'status': 'offline',
						'profile': {
							'userId': userId,
						}
					});
				}
			}
		},this);
	}
}
Normal.prototype.user_editProfile=function(data){
	if(!data.hasOwnProperty('password')){
		this._user.send({
			'action': 'user_editProfile',
			'status': 'auth fail'
		});
		return;
	}
	var _=this;
	delete data.action;
	this._user.profile(data,function(error,result){
		if(error || !result){
			_._user.send({
				'action': 'user_editProfile',
				'status': 'fail'
			});
		}else{
			_._user.send({
				'action': 'user_editProfile',
				'status': 'success'
			});
		}
	});
}
Normal.prototype.user_logout=function(data){
	this._user.exit();
}
Normal.prototype._quotaReset=function(_){
	_._quota_sendMsg=Math.min(_._quota_sendMsg+quota_sendMsg,quota_sendMsg);
}
Normal.prototype._umount=function(){
	clearInterval(this._quotaResetInterval);
	Base.prototype._umount.call(this);
}

module.exports=Normal;