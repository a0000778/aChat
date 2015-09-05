'use strict';
var crypto=require('crypto');
var util=require('util');
var Base=require('./Base.js');
var channel=require('../channel.js');
var config=require('../config.js');
var user=require('../user.js');
var actionGroup=require('../actionGroup.js');

/* 驗證身份指令組 */
function Auth(link){
	Base.call(this,undefined);
	this._authing=false;
	this._link=link;
	this._timeout=setTimeout(Auth.timeout,10000,link);
}
util.inherits(Auth,Base);
Auth.prototype._umount=function(){
	if(this._timeout) clearTimeout(this._timeout);
	Base.prototype._umount.call(this);
}
Auth.timeout= (link) => link.exit(4100);
Auth.prototype.createSession=function(data,link){
	if(this._authing || !(
		link._question && 
		data.hasOwnProperty('username') && user.fieldCheck.username(data.username) &&
		data.hasOwnProperty('answer') && (data.answer=Base.toBuffer(data.answer)) && user.fieldCheck.answer(data.answer)
	)) return;
	var _=this;
	let question=link._question;
	this._authing=true;
	link._question=null;
	user.authByPassword(data.username,question,data.answer,function(result){
		if(result=='disabled')
			_._link.exit(4101);
		else if(result=='fail')
			_._link.exit(4102);
		else{
			if(_._link.link.protocol=='adminv1' && result.actionGroup!='Admin'){
				_._user.exit(4102);
				return;
			}
			user.createSession(result.userId,function(session){
				_._link.send({
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
	var _=this;
	this._authing=true;
	user.authBySession(data.userId,data.session,link,function(result){
		if(result=='disabled')
			_._link.exit(4101);
		else if(result=='fail')
			_._link.exit(4102);
		else{
			_._link.send({
				'action': 'authBySession',
				'status': 'success',
				'userId': data.userId
			});
			_._link.send({
				'action': 'channel_switch',
				'status': 'default',
				'channelId': _._link.user.channel.channelId
			});
		}
		_._umount();
		_._authing=false;
	});
}

module.exports=Auth;