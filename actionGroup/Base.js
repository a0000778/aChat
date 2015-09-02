'use strict';
var channel=require('../channel.js');
var crypto=require('crypto');

function Base(user){
	this._user=user;
	this._question=null;
}
Base.toBuffer=function(hex){
	return util.isString(hex) && /^[0-9a-f]+$/i.test(hex) && new Buffer(hex,'hex');
}
Base.makeChannelList=function(){
	let chList=[];
	for(let ch of channel.list())
		chList.push({'channelId':ch.channelId,'name':ch.name});
	return chList;
}
Base.prototype._exec=function(data,link){
	if(data.type!=='utf8') return;
	try{
		data=JSON.parse(data.utf8Data);
	}catch(e){ return; }
	if(typeof(data.action)==='string' && data.action.charCodeAt(0)!==95 && this[data.action])
		this[data.action].call(this,data,link);
}
Base.prototype._execObject=function(data,link){
	if(typeof(data.action)==='string' && data.action.charCodeAt(0)!==95 && this[data.action])
		this[data.action].apply(this,arguments);
}
Base.prototype._umount=function(){
	this._user=null;
}
Base.prototype.createQuestion=function(data){
	if(!this._question)
		this._question=crypto.randomBytes(8);
	this._user.send({
		'action': 'question',
		'question': this._question.toString('hex')
	});
}

module.exports=Base;