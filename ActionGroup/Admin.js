var Util=require('util');
var Base=require('./Base.js');
var Channel=require('../Channel.js');
var Config=require('../Config.js');
var DB=require('../DB.js');
var User=require('../User.js');

/* 管理指令組 */
function Admin(user){
	this.user=user;
	
}
Util.inherits(Admin,Base);
Admin.prototype.action={
	'channel_create': function(data){
		if(data.hasOwnProperty('name') && data.name.length>0){
			var _=this;
			DB.createChannel(
				{'name': data.name},
				function(error,result){
					if(error){
						_.user.send({
							'action': 'channel_create',
							'status': 'fail'
						});
						return;
					}
					new Channel(result.insertId,data.name);
					_.user.send({
						'action': 'channel_create',
						'status': 'success'
					});
					User.send(Channel.channelList.reduce(function(list,user){
						list.push({'id':user.id,'username':user.username});
						return list;
					},[]));
				}
			);
		}
	},
	'channel_edit': function(data){
		if(data.hasOwnProperty('id') && /^\d+$/.test(data.id) && data.id>0){
			var channel=Channel.findById(data.id);
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
						data.id,
						editData,
						function(error){
							if(error){
								_.user.send({
									'action': 'channel_edit',
									'status': 'fail'
								});
								return;
							}
							for(var field in editData){
								channel[field]=editData[field];
							}
							_.user.send({
								'action': 'channel_edit',
								'status': 'success'
							});
							//刷新所有使用者的頻道列表可以做成 function
							User.send(Channel.channelList.reduce(function(list,user){
								list.push({'id':user.id,'username':user.username});
								return list;
							},[]));
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
	},
	'channel_delete': function(data){
		if(data.hasOwnProperty('id') && /^\d+$/.test(data.id) && data.id>0){
			if(data.id==Config.channelDefault){
				this.send({
					'action': 'channel_delete',
					'status': 'is default channel'
				});
				return;
			}
			var channel=Channel.findById(data.id);
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
					data.id,
					function(error){
							if(error){
							_.user.send({
								'action': 'channel_delete',
								'status': 'fail'
							});
							return;
						}
						_.user.send({
							'action': 'channel_delete',
							'status': 'success'
						});
						//刷新所有使用者的頻道列表可以做成 function
						User.send(Channel.channelList.reduce(function(list,user){
							list.push({'id':user.id,'username':user.username});
							return list;
						},[]));
					}
				);
			}else{
				this.send({
					'action': 'channel_delete',
					'status': 'not exists'
				});
			}
		}
	},
	'user_kick': function(data){
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
	},
	'user_ban': function(data){
		if(data.hasOwnProperty('userId') && /^\d+$/.test(data.userId) && data.userId>0){
			var _=this;
			DB.updateUserInfo(
				data.userId,
				{'action': false},
				function(error,result){
					if(error){
						_.user.send({
							'action': 'user_ban',
							'status': 'fail'
						});
						return;
					}
					if(!result.affectedRows){
						_.user.send({
							'action': 'user_ban',
							'status': 'not exists'
						});
						return;
					}
					var user=User.findById(data.userId);
					if(user){
						user.exit(4104);
						_.user.send({
							'action': 'user_ban',
							'status': 'success'
						});
					}
				}
			);
		}
	},
	'user_unban': function(data){
		if(data.hasOwnProperty('userId') && /^\d+$/.test(data.userId) && data.userId>0){
			var _=this;
			DB.updateUserInfo(
				data.userId,
				{'action': true},
				function(error,result){
					if(error){
						_.user.send({
							'action': 'user_unban',
							'status': 'fail'
						});
						return;
					}
					if(!result.affectedRows){
						_.user.send({
							'action': 'user_unban',
							'status': 'not exists'
						});
						return;
					}
				}
			);
		}
	},
	'server_alert': function(data){
		if(data.hasOwnProperty('msg') && !data.msg.length) return;
		if(data.hasOwnProperty('userId') && /^\d+$/.test(data.userId) && data.userId>0){
			var user=User.findById(data.userId);
			if(user){
				user.send({
					'action': 'chat_alert_server',
					'msg': data.msg
				});
				this.user.send({
					'action': 'server_alert',
					'status': 'success'
				});
			}else{
				this.user.send({
					'action': 'server_alert',
					'status': 'fail'
				});
			}
		}else if(data.hasOwnProperty('channelId') && /^\d+$/.test(data.channelId) && data.channelId>0){
			var channel=Channel.findById(data.userId);
			if(channel){
				channel.send({
					'action': 'chat_alert_server',
					'msg': data.msg
				});
				this.user.send({
					'action': 'server_alert',
					'status': 'success'
				});
			}else{
				this.user.send({
					'action': 'server_alert',
					'status': 'fail'
				});
			}
		}else{
			User.send({
				'action': 'chat_alert_server',
				'msg': data.msg
			});
			this.user.send({
				'action': 'server_alert',
				'status': 'success'
			});
		}
	}
};

module.exports=Admin;