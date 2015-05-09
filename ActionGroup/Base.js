'use strict';
var Channel=require('../Channel.js');

function Base(user){
	this._user=user;
}
Base.makeChannelList=function(){
	return Channel.list().reduce(function(list,channel){
		list.push({'channelId':channel.channelId,'name':channel.name})
		return list;
	},[]);
}
Base.prototype._exec=function(data){
	if(data.type!=='utf8') return;
	try{
		data=JSON.parse(data.utf8Data);
	}catch(e){ return; }
	if(typeof(data.action)==='string' && data.action.charCodeAt!==95 && this[data.action])
		this[data.action].call(this,data);
}
Base.prototype._execObject=function(data){
	if(typeof(data.action)==='string' && data.action.charCodeAt!==95 && this[data.action])
		this[data.action].apply(this,arguments);
}
Base.prototype._umount=function(){
	this._user=null;
}

module.exports=Base;