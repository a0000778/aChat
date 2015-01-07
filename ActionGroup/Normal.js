var Util=require('util');
var Base=require('./Base.js');
var Channel=require('../Channel.js');
var DB=require('../DB.js');
var User=require('../User.js');

/* 一般指令組 */
function Normal(user){
	this.user=user;
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
	'channel_userList': function(data,list){
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
			'list': list? list:channel.onlineList.reduce(function(list,user){
				list.push({'id':user.id,'username':user.username});
				return list;
			},[])
		});
	},
	'chat_normal': function(data){
		if(!data.msg || typeof(data.msg)!='string' || !data.msg.length) return;
		if(!this.user.channel) return;
		this.user.channel.send({
			'action': 'chat_normal',
			'fromUserId': this.user.id,
			'msg': data.msg
		});
		DB.writeChatLog(0,this.user.channel.id,this.user.id,null,data.msg);
	},
	'chat_private': function(data){
		if(!/^\d+$/.test(data.toUserId) || data.toUserId<=0) return;
		if(!data.msg || typeof(data.msg)!='string' || !data.msg.length) return;
		var target=User.findById(data.toUserId);
		if(target){
			var sendData=JSON.stringify({
				'action': 'chat_private',
				'fromUserId': this.user.id,
				'toUserId': data.toUserId
				'msg': data.msg
			});
			target.send(sendData);
			this.user.send(sendData);
			DB.writeChatLog(1,null,this.user.id,target.id,data.msg);
		}else{
			this.user.send({
				'action': 'chat_private_fail',
				'status': 'offline or not exists',
				'toUserId': data.toUserId
			});
		}
	},
	'user_getProfile': function(data){
		var _=this;
		this.user.profile(null,function(error,result){
			if(error || !result){
				_.user.send({
					'action': 'user_getProfile',
					'status': 'fail'
				});
			}else{
				_.user.send({
					'action': 'user_getProfile',
					'status': 'success',
					'profile': result
				});
			}
		});
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
		data.action=undefined;
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

module.exports=Normal;