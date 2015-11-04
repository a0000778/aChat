'use strict';
let crypto=require('crypto');
let util=require('util');
let Base=require('./Base.js');
let channel=require('../channel.js');
let config=require('../config.js');
let user=require('../user.js');
let actionGroup=require('../actionGroup.js');

/* 驗證身份指令組 */
function Auth(link){
	Base.call(this,undefined);
	this._authing=false;
	this._timeout=setTimeout(Auth.timeout,10000,link);
}
util.inherits(Auth,Base);
Auth.prototype._umount=function(){
	if(this._timeout) clearTimeout(this._timeout);
	Base.prototype._umount.call(this);
}
Auth.timeout= (link) => link.exit(4100);
Auth.prototype.client=function(data,link){
	if(link.client && !(data.hasOwnProperty('client') && user.fieldCheck.client(data.client))) return;
	link.client=data.client;
}
Auth.prototype.createSession=function(data,link){
	if(this._authing || !(
		link._question && 
		data.hasOwnProperty('username') && user.fieldCheck.username(data.username) &&
		data.hasOwnProperty('answer') && (data.answer=Base.toBuffer(data.answer)) && user.fieldCheck.answer(data.answer)
	)) return;
	let _=this;
	let question=link._question;
	this._authing=true;
	link._question=null;
	user.authByPassword(data.username,question,data.answer,function(result){
		if(result=='disabled')
			link.exit(4101);
		else if(result=='fail')
			link.exit(4102);
		else{
			if(link.link.protocol=='adminv1' && result.actionGroup!='Admin'){
				link.exit(4102);
				return;
			}
			user.createSession(result.userId,function(session){
				link.send({
					'action': 'createSession',
					'userId': result.userId,
					'session': session.toString('hex')
				});
				_._authing=false;
			});
		}
	});
}
Auth.prototype.authBySession=function(data,link){
	if(this._authing || !(
		data.hasOwnProperty('userId') && user.fieldCheck.userId(data.userId) &&
		data.hasOwnProperty('session') && (data.session=Base.toBuffer(data.session)) && user.fieldCheck.session(data.session)
	)) return;
	let _=this;
	this._authing=true;
	user.authBySession(data.userId,data.session,link,function(result){
		if(result=='disabled')
			link.exit(4101);
		else if(result=='fail')
			link.exit(4102);
		else if(result=='repeat login')
			link.exit(4103);
		else{
			link.send({
				'action': 'authBySession',
				'status': 'success',
				'userId': data.userId,
				'actionGroup': link.user.actionGroup.constructor.name
			});
			link.send({
				'action': 'channel_switch',
				'status': 'default',
				'channelId': link.user.channel.channelId
			});
		}
		_._umount();
		_._authing=false;
	});
}

module.exports=Auth;