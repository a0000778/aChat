'use strict';
var Util=require('util');
var Channel=require('../Channel.js');
var Config=require('../Config.js');
var DB=require('../DB.js');
var Normal=require('./Normal.js');
var User=require('../User.js');

/* 管理指令組 */
function Admin(user){
	Normal.call(this,user);
}
Util.inherits(Admin,Normal);
Admin.prototype._allUserExec=function(actionGroup,action){
	if(Util.isArray(actionGroup)){
		User.userList.forEach(function(user){
			if(actionGroup.indexOf(user.actionGroup.constructor.name)!==-1){
				var args=Array.prototype.slice(1);
				user.actionGroup._execObject.apply(user.actionGroup,args);
			}
		});
	}else if(typeof(actionGroup)=='string'){
		User.userList.forEach(function(user){
			if(user.actionGroup.constructor.name==actionGroup){
				var args=Array.prototype.slice(1);
				user.actionGroup._execObject.apply(user.actionGroup,args);
			}
		});
	}
}
Admin.prototype.channel_create=function(data){
	if(data.hasOwnProperty('name') && data.name.length>0){
		var _=this;
		DB.createChannel(
			{'name': data.name},
			function(error,result){
				if(error){
					_._user.send({
						'action': 'channel_create',
						'status': 'fail'
					});
					return;
				}
				new Channel(result.insertId,data.name);
				_._user.send({
					'action': 'channel_create',
					'status': 'success'
				});
				_._allUserExec('Normal',{'action':'channel_list'},Base.makeChannelList());
			}
		);
	}
}
Admin.prototype.channel_edit=function(data){
	if(data.hasOwnProperty('channelId') && /^\d+$/.test(data.channelId) && data.channelId>0){
		var channel=Channel.findById(data.channelId);
		if(channel){
			var _=this;
			var hasEditData=false;
			var editData=['name'].reduce(function(editData,field){
				if(data.hasOwnProperty(field)){//需補上資料檢查
					hasEditData=true;
					editData[field]=data.field;
				}
			},{});
			if(hasEditData){
				DB.editChannel(
					data.channelId,
					editData,
					function(error){
						if(error){
							_._user.send({
								'action': 'channel_edit',
								'status': 'fail'
							});
							return;
						}
						for(var field in editData){
							channel[field]=editData[field];
						}
						_._user.send({
							'action': 'channel_edit',
							'status': 'success'
						});
						_._allUserExec('Normal',{'action':'channel_list'},Base.makeChannelList());
					}
				);
			}
		}else{
			this.send({
				'action': 'channel_edit',
				'status': 'not exists'
			});
		}
	}
}
Admin.prototype.channel_delete=function(data){
	if(data.hasOwnProperty('channelId') && /^\d+$/.test(data.channelId) && data.channelId>0){
		if(data.channelId==Config.channelDefault){
			this.send({
				'action': 'channel_delete',
				'status': 'default channel'
			});
			return;
		}
		var channel=Channel.findById(data.channelId);
		if(channel){
			var _=this;
			var channelDefault=Channel.findById(Config.channelDefault);
			if(!channelDefault){
				this.send({
					'action': 'channel_delete',
					'status': 'default channel not exists'
				});
				return;
			}
			channel.lock=true;
			channel.onlineList.forEach(function(user){
				channelDefault.join(user);
			});
			channel.send({
				'action': 'channel_switch',
				'status': 'force',
				'channelId': Config.channelDefault
			});
			DB.deleteChannel(
				data.channelId,
				function(error){
						if(error){
						_._user.send({
							'action': 'channel_delete',
							'status': 'fail'
						});
						return;
					}
					_._user.send({
						'action': 'channel_delete',
						'status': 'success'
					});
					_._allUserExec('Normal',{'action':'channel_list'},Base.makeChannelList());
				}
			);
		}else{
			this.send({
				'action': 'channel_delete',
				'status': 'not exists'
			});
		}
	}
}
Admin.prototype.user_kick=function(data){
	if(data.hasOwnProperty('userId') && /^\d+$/.test(data.userId) && data.userId>0){
		var user=User.findById(data.userId);
		if(user){
			user.exit(4104);
			this.user.send({
				'action': 'user_kick',
				'status': 'success'
			});
		}else{
			this.user.send({
				'action': 'user_kick',
				'status': 'not exists'
			});
		}
	}
}
Admin.prototype.user_ban=function(data){
	if(data.hasOwnProperty('userId') && /^\d+$/.test(data.userId) && data.userId>0){
		var _=this;
		DB.updateUserInfo(
			data.userId,
			{'action': false},
			function(error,result){
				if(error){
					_._user.send({
						'action': 'user_ban',
						'status': 'fail'
					});
					return;
				}
				if(!result.affectedRows){
					_._user.send({
						'action': 'user_ban',
						'status': 'not exists'
					});
					return;
				}
				var user=User.findById(data.userId);
				if(user){
					user.exit(4104);
					_._user.send({
						'action': 'user_ban',
						'status': 'success'
					});
				}
			}
		);
	}
}
Admin.prototype.user_unban=function(data){
	if(data.hasOwnProperty('userId') && /^\d+$/.test(data.userId) && data.userId>0){
		var _=this;
		DB.updateUserInfo(
			data.userId,
			{'action': true},
			function(error,result){
				if(error){
					_._user.send({
						'action': 'user_unban',
						'status': 'fail'
					});
					return;
				}
				if(!result.affectedRows){
					_._user.send({
						'action': 'user_unban',
						'status': 'not exists'
					});
					return;
				}
				_._user.send({
					'action': 'user_unban',
					'status': 'success'
				});
			}
		);
	}
}
Admin.prototype.chat_global=function(data){
	if(data.hasOwnProperty('msg') && !data.msg.length) return;
	if(data.hasOwnProperty('userId') && /^\d+$/.test(data.userId) && data.userId>0){
		var user=User.findById(data.userId);
		if(user){
			user.send({
				'action': 'chat_global',
				'msg': data.msg
			});
			this.user.send({
				'action': 'chat_global',
				'status': 'success'
			});
		}else{
			this.user.send({
				'action': 'chat_global',
				'status': 'fail'
			});
		}
	}else if(data.hasOwnProperty('channelId') && /^\d+$/.test(data.channelId) && data.channelId>0){
		var channel=Channel.findById(data.channelId);
		if(channel){
			channel.send({
				'action': 'chat_global',
				'msg': data.msg
			});
			this.user.send({
				'action': 'chat_global',
				'status': 'success'
			});
		}else{
			this.user.send({
				'action': 'chat_global',
				'status': 'fail'
			});
		}
	}else{
		User.send({
			'action': 'chat_global',
			'msg': data.msg
		});
		this.user.send({
			'action': 'chat_global',
			'status': 'success'
		});
	}
}
Admin.prototype._umount=function(){
	clearInterval(this._quotaResetInterval);
	Base.prototype._umount.call(this);
}

module.exports=Admin;