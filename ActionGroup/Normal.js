'use strict';
var Util=require('util');
var Base=require('./Base.js');
var Channel=require('../Channel.js');
var DB=require('../DB.js');
var User=require('../User.js');

var quota_sendMsg=15;		//限制每20秒發訊息次數，超過限制則懲罰20~40秒內無法發言

/* 一般指令組 */
function Normal(user){
	this.user=user;
	this.quota_sendMsg=quota_sendMsg;
	this.quotaResetInterval=setInterval(this.quotaReset,20000,this);
}
Util.inherits(Normal,Base);
Normal.prototype.action={
	'channel_list': function(data,list){
		this.user.send({
			'action': 'channel_list',
			'list': list? list:Base.makeChannelList()
		})
	},
	'channel_switch': function(data){
		if(!/^\d+$/.test(data.channelId) || data.channelId<=0) return;
		var channel=Channel.findById(data.channelId);
		if(channel){
			if(channel.join(this.user)){
				this.user.send({
					'action': 'channel_switch',
					'status': 'success',
					'channelId': data.channelId
				});
			}else{
				this.user.send({
					'action': 'channel_switch',
					'status': 'full',
					'channelId': data.channelId
				});
			}
		}else{
			this.user.send({
				'action': 'channel_switch',
				'status': 'not exists',
				'channelId': data.channelId
			});
		}
	},
	'channel_userList': function(data,channelId,list){
		if(data.hasOwnProperty('channelId')){
			if(!/^\d+$/.test(data.channelId) && data.channelId<=0){
				var channel=Channel.findById(data.channelId);
				if(!channel){
					this.user.send({
						'action': 'channel_userList',
						'status': 'not exists'
					});
					return;
				}
			}else return;
		}else{
			var channel=this.user.channel;
		}
		this.user.send({
			'action': 'channel_userList',
			'status': 'success',
			'channelId': channelId || channel.channelId,
			'userList': list || channel.onlineList.reduce(function(list,user){
				list.push({'userId':user.userId,'username':user.username});
				return list;
			},[])
		});
	},
	'chat_normal': function(data){
		if(!data.msg || typeof(data.msg)!='string' || !data.msg.length) return;
		if(!this.user.channel) return;
		var time=Math.floor(new Date().getTime()/1000);
		if(this.quota_sendMsg<=0){
			this.user.send({
				'action': 'chat_notice',
				'msg': '超過每20秒發言頻率上限，請稍候再試。',
				'time': time
			});
			this.quota_sendMsg-=quota_sendMsg;
			return;
		}
		this.quota_sendMsg--;
		this.user.channel.send({
			'action': 'chat_normal',
			'fromUserId': this.user.userId,
			'msg': data.msg,
			'time': time
		});
		DB.writeChatLog(time,0,this.user.channel.channelId,this.user.userId,null,data.msg);
	},
	'chat_private': function(data){
		if(!/^\d+$/.test(data.toUserId) || data.toUserId<=0) return;
		if(!data.msg || typeof(data.msg)!='string' || !data.msg.length) return;
		var target=User.findById(data.toUserId);
		if(target){
			var time=Math.floor(new Date().getTime()/1000);
			if(this.quota_sendMsg<=0){
				this.user.send({
					'action': 'chat_notice',
					'msg': '超過每20秒發言頻率上限，請稍候再試。',
					'time': time
				});
				this.quota_sendMsg-=quota_sendMsg;
				return;
			}
			this.quota_sendMsg--;
			var sendData=JSON.stringify({
				'action': 'chat_private',
				'fromUserId': this.user.userId,
				'toUserId': data.toUserId,
				'msg': data.msg,
				'time': time
			});
			target.send(sendData);
			this.user.send(sendData);
			DB.writeChatLog(time,1,null,this.user.userId,target.userId,data.msg);
		}else{
			this.user.send({
				'action': 'chat_private',
				'error': 'offline or not exists',
				'toUserId': data.toUserId
			});
		}
	},
	'user_getProfile': function(data){
		if(Array.isArray(data.userIds) && data.userIds.reduce(function(result,userId){
			return result && /^\d+$/.test(userId)
		},true)){
			var _=this;
			data.userIds.forEach(function(userId){
				if(userId===this.user.userId){
					this.user.profile(null,function(error,result){
						if(error || !result){
							_.user.send({
								'action': 'user_getProfile',
								'status': 'fail',
								'profile': {'userId': _.user.userId}
							});
						}else{
							_.user.send({
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
						_.user.send({
							'action': 'user_getProfile',
							'status': 'success',
							'profile': {
								'userId': user.userId,
								'username': user.username,
								'regTime': user.regTime
							}
						});
					}else{
						_.user.send({
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
	},
	'user_editProfile': function(data){
		if(!data.hasOwnProperty('password')){
			this.user.send({
				'action': 'user_editProfile',
				'status': 'auth fail'
			});
			return;
		}
		var _=this;
		delete data.action;
		this.user.profile(data,function(error,result){
			if(error || !result){
				_.user.send({
					'action': 'user_editProfile',
					'status': 'fail'
				});
			}else{
				_.user.send({
					'action': 'user_editProfile',
					'status': 'success'
				});
			}
		});
	},
	'user_logout': function(data){
		this.user.exit();
	}
}
Normal.prototype.quotaReset=function(_){
	_.quota_sendMsg=Math.min(_.quota_sendMsg+quota_sendMsg,quota_sendMsg);
}
Normal.prototype.umount=function(){
	clearInterval(this.quotaResetInterval);
}

module.exports=Normal;