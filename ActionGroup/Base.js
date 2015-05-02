var Channel=require('../Channel.js');

function Base(){}
Base.makeChannelList=function(){
	return Channel.list().reduce(function(list,channel){
		list.push({'channelId':channel.channelId,'name':channel.name})
		return list;
	},[]);
}
Base.prototype.exec=function(data){
	if(data.type!=='utf8') return;
	try{
		data=JSON.parse(data.utf8Data);
	}catch(e){ return; }
	if(typeof(data.action)==='string' && this.action.hasOwnProperty(data.action))
		this.action[data.action].call(this,data);
}
Base.prototype._exec=function(data){
	if(typeof(data.action)==='string' && this.action.hasOwnProperty(data.action))
		this.action[data.action].apply(this,arguments);
}

module.exports=Base;