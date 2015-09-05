'use strict';
var config=require('./config.js');
var db=require('./db.js');

var channel={};
var channelList=new Map();

channel.create=function(name,callback){
	db.createChannel(name,function(channelId){
		new Channel(channelId,name);
		callback(channelId);
	});
}
channel.loadAll=function(callback){
	if(channelList.size) return;
	db.getAllChannel(function(result){
		for(let ch of result)
			new Channel(ch.channelId,ch.name);
		callback();
	});
}
channel.findById= (channelId) => channelList.get(channelId);
channel.list=function(){
	let list=[];
	for(let ch of channelList.values())
		list.push(ch);
	return list;
}
channel.send=function(data){
	if(!(Buffer.isBuffer(data) || typeof(data)==='string'))
		data=JSON.stringify(data);
	for(let ch of channelList.values())
		ch.send(data);
}

function Channel(channelId,name){
	this.channelId=channelId;
	this.name=name;
	this.lock=false;
	this.onlineList=new Set();
	this.onlineMax=config.channelUserMax;
	channelList.set(this.channelId,this);
}
Channel.prototype.delete=function(callback){
	if(this.onlineList.size)
		throw new Error('channel not empty')
	var _=this;
	db.deleteChannel(this.channelId,function(){
		channelList.delete(_.channelId);
		callback();
	});
}
Channel.prototype.exit=function(user){
	if(this.onlineList.has(user)){
		this.onlineList.delete(user);
		user.channel=null;
		this.send({
			'action': 'channel_exit',
			'userId': user.userId
		});
	}
	return this;
}
Channel.prototype.join=function(user,force){
	if(this.lock) return false;
	if(this.onlineList.has(user)) return true;
	if(this.onlineMax<=this.onlineList.size && !force) return false;
	if(user.channel) user.channel.exit(user);
	this.send({
		'action': 'channel_join',
		'userId': user.userId
	});
	this.onlineList.add(user);
	user.channel=this;
	return true;
}
Channel.prototype.list=function(){
	let list=[];
	for(let u of this.onlineList)
		list.push(u);
	return list;
}
Channel.prototype.send=function(data){
	if(!(Buffer.isBuffer(data) || typeof(data)==='string'))
		data=JSON.stringify(data);
	for(let client of this.onlineList)
		client.send(data);
	return this;
}
Channel.prototype.update=function(name,callback){
	if(name.length===0)
		throw new Error('field format error');
	var _=this;
	db.updateChannel(this.channelId,name,function(){
		_.name=name;
		callback();
	});
}

module.exports=channel;