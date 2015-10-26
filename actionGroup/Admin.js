'use strict';
var util=require('util');
var channel=require('../channel.js');
var config=require('../config.js');
var db=require('../db.js');
var Base=require('./Base.js');
var Normal=require('./Normal.js');
var user=require('../user.js');

function Admin(user){
	Normal.call(this,user);
}
util.inherits(Admin,Normal);
Admin.prototype.admin_channel_create=function(data,link){
	if(data.hasOwnProperty('name') && data.name.length>0){
		var _=this;
		channel.create(data.name,function(){
			link.send({
				'action': 'admin_channel_create',
				'status': 'success'
			});
			_._allUserExec('Normal',{'action':'channel_list'},Base.makeChannelList());
		});
	}
}
Admin.prototype.admin_channel_edit=function(data,link){
	if(Number.isSafeInteger(data.channelId) && data.channelId>0){
		var ch=channel.findById(data.channelId);
		if(ch && ch.name!==data.name){
			var _=this;
			ch.update(data.name,function(error){
				_._user.send({
					'action': 'admin_channel_edit',
					'status': 'success'
				});
				_._allUserExec('Normal',{'action':'channel_list'},Base.makeChannelList());
			});
		}else{
			link.send({
				'action': 'admin_channel_edit',
				'status': 'not exists'
			});
		}
	}
}
Admin.prototype.admin_channel_delete=function(data,link){
	if(Number.isSafeInteger(data.channelId) && data.channelId>0){
		let ch,chDefault;
		if(data.channelId==config.channelDefault){
			this.send({
				'action': 'admin_channel_delete',
				'status': 'default channel'
			});
		}else if(!(chDefault=channel.findById(config.channelDefault))){
			link.send({
				'action': 'admin_channel_delete',
				'status': 'default channel not exists'
			});
		}else if(ch=channel.findById(data.channelId)){
			var _=this;
			ch.lock=true;
			ch.send({
				'action': 'channel_switch',
				'status': 'force',
				'channelId': chDefault.channelId
			});
			for(let u of ch.list())
				chDefault.join(u);
			ch.delete(function(){
				link.send({
					'action': 'admin_channel_delete',
					'status': 'success'
				});
				_._allUserExec('Normal',{'action':'channel_list'},Base.makeChannelList());
			});
		}else{
			link.send({
				'action': 'admin_channel_delete',
				'status': 'not exists'
			});
		}
	}
}
Admin.prototype.admin_user_kick=function(data,link){
	if(user.fieldCheck.userId(data.userId)){
		let u=user.findUser('userId',data.userId);
		if(user){
			user.exit(4104);
			link.send({
				'action': 'admin_user_kick',
				'status': 'success'
			});
		}else{
			link.send({
				'action': 'admin_user_kick',
				'status': 'not exists'
			});
		}
	}
}
Admin.prototype.admin_user_ban=function(data,link){
	if(user.fieldCheck.userId(data.userId)){
		var u=user.findUser('userId',data.userId,function(result){
			if(result){
				if(u) u.exit(4104);
				user.updateProfile(data.userId,{'active': false},function(){
					link.send({
						'action': 'admin_user_ban',
						'status': 'success'
					});
				});
			}else{
				link.send({
					'action': 'admin_user_ban',
					'status': 'not exists'
				});
			}
		});
	}
}
Admin.prototype.admin_user_unban=function(data,link){
	if(user.fieldCheck.userId(data.userId)){
		user.findUser('userId',data.userId,function(result){
			if(result){
				user.updateProfile(data.userId,{'active': true},function(){
					link.send({
						'action': 'admin_user_unban',
						'status': 'success'
					});
				});
			}else{
				link.send({
					'action': 'admin_user_unban',
					'status': 'not exists'
				});
			}
		});
	}
}
Admin.prototype.admin_chat_global=function(data,link){
	if(!(data.hasOwnProperty('msg') && data.msg.length)) return;
	let time=new Date();
	if(user.fieldCheck.userId(data.userId)){
		let u=user.findUser('userId',data.userId);
		if(u){
			u.send({
				'action': 'chat_global',
				'time': time.getTime(),
				'msg': data.msg
			});
			db.writeChatLog(time,3,null,this._user.userId,data.userId,data.msg);
			link.send({
				'action': 'admin_chat_global',
				'status': 'success'
			});
		}else{
			link.send({
				'action': 'admin_chat_global',
				'status': 'fail'
			});
		}
	}else if(Number.isSafeInteger(data.channelId) && data.channelId>0){
		let ch=channel.findById(data.channelId);
		if(ch){
			ch.send({
				'action': 'chat_global',
				'time': time.getTime(),
				'msg': data.msg
			});
			db.writeChatLog(time,3,data.channelId,this._user.userId,null,data.msg);
			link.send({
				'action': 'admin_chat_global',
				'status': 'success'
			});
		}else{
			link.send({
				'action': 'admin_chat_global',
				'status': 'fail'
			});
		}
	}else{
		user.send({
			'action': 'chat_global',
			'time': time.getTime(),
			'msg': data.msg
		});
		db.writeChatLog(time,3,null,this._user.userId,null,data.msg);
		link.send({
			'action': 'admin_chat_global',
			'status': 'success'
		});
	}
}
Admin.prototype._allUserExec=function(actionGroup,action){
	let extArgs=Array.prototype.slice.call(arguments,2);
	if(Array.isArray(actionGroup)){
		for(let u of user.listUser()){
			if(actionGroup.indexOf(u.actionGroup.constructor.name)!==-1){
				for(let s of u.sessions.values()){
					let args=[action,s].concat(extArgs);
					u.actionGroup._execObject.apply(u.actionGroup,args);
				}
			}
		}
	}else if(typeof(actionGroup)==='string'){
		for(let u of user.listUser()){
			if(u.actionGroup.constructor.name===actionGroup){
				for(let s of u.sessions.values()){
					let args=[action,s].concat(extArgs);
					u.actionGroup._execObject.apply(u.actionGroup,args);
				}
			}
		}
	}
}
Admin.prototype._umount=function(){
	Normal.prototype._umount.call(this);
}

module.exports=Admin;