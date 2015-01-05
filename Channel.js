var Config=require('./Config.js');

function Channel(id,name){
	this.id=id;
	this.name=name;
	this.onlineList=[];
	this.onlineMax=Config.channelUserMax;
	Channel.channelIndexId.push(this.id);
	Channel.channelList.push(this);
}
Channel.channelIndexId=[];
Channel.channelList=[];
Channel.findById=function(id){
	var index=this.channelIndexId.indexOf(id);
	return index>=0? this.channelList[index]:null;
}
Channel.list=function(){
	return this.channelList;
}
Channel.send=function(data){
	if(!(Buffer.isBuffer(data) || typeof(data)==='string'));
		data=JSON.stringify(data);
	this.channelList.forEach(function(channel){
		channel.send(data);
	});
	return this;
}
Channel.prototype.close=function(){
	Channel.channelList.splice(Channel.channelList.indexOf(this),1);
}
Channel.prototype.exit=function(user){
	var index=this.onlineList.indexOf(user);
	if(index>=0){
		this.onlineList.splice(index,1);
		user.channel=null;
	}
	return true;
}
Channel.prototype.join=function(user,force){
	if(this.onlineList.indexOf(user)>=0) return true;
	if(this.onlineMax<=this.onlineList.length && !force) return false;
	if(user.channel) user.channel.exit(user);
	this.onlineList.push(user);
	user.channel=this;
	return true;
}
Channel.prototype.send=function(data){
	if(!(Buffer.isBuffer(data) || typeof(data)==='string'));
		data=JSON.stringify(data);
	this.onlineList.forEach(function(client){
		client.send(data);
	});
	return this;
}

module.exports=Channel;