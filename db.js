'use strict';
var crypto=require('crypto');
var mysql=require('mysql');
var config=require('./config.js');

var pool=mysql.createPool(config.mysql);
var db={};

/* Channel */
(function(db){
	/*
		- callback	Function
			- result	Array
				- channelId	Number
				- name		String
	*/
	db.getAllChannel=function(callback){
		pool.query('SELECT * FROM `channel`;',[],function(error,result){
			if(error) throw error;
			callback(result);
		});
	}
	/*
		- name		String
		- callback	Function
			- channelId	Number
	*/
	db.createChannel=function(name,callback){
		pool.query('INSERT INTO `channel` (`name`) VALUES (?);',[[name]],function(error,result){
			if(error) throw error;
			callback(result.insertId);
		});
	}
	/*
		- channelId	Number
		- newName	String
		- callback	Function
	*/
	db.updateChannel=function(channelId,newName,callback){
		pool.query('UPDATE `channel` SET `name`=? WHERE `channelId`=?;',[name,channelId],function(error,result){
			if(error) throw error;
			if(result.changedRows)
				callback();
			else
				throw new Error('channelId not exists');
		});
	}
	/*
		- channelId	Number
		- callback	Function
	*/
	db.deleteChannel=function(channelId,callback){
		pool.query('DELETE FROM `channel` WHERE `channelId`=?;',[channelId],function(error,result){
			if(error) throw error;
			callback();
		});
	}
})(db);

/* User */
(function(db){
	/*
		- username	String
		- email		String
		- callback	Function
			- exists	String or Null
	*/
	db.checkUserExists=function(username,email,callback){
		pool.query('SELECT `userId` FROM `user` WHERE `username`=? OR `email`=?;',[username,email],function(error,result){
			if(error) throw error;
			if(result.length===2)
				callback('username,email');
			else if(result.length===0)
				callback(null);
			else if(result.username==username)
				callback('username');
			else
				callback('email');
		});
	}
	/*
		- username	String
		- password	Buffer
		- email		String
		- active	Boolean
		- callback	Function
			- userId	Number
	*/
	db.createUser=function(username,password,email,active,callback){
		pool.query(
			'INSERT INTO `user` (`username`,`password`,`email`,`active`,`regTime`) VALUES (?);',
			[[username,password,email,active,new Date]],
			function(error,result){
				if(error) throw error;
				callback(result.insertId);
			}
		);
	}
	/*
		- userId	Number
		- callback	Function
			- session	Buffer
	*/
	db.createSession=function(userId,callback){
		var session=crypto.randomBytes(20);
		pool.query(
			'INSERT INTO `session` (`session`,`userId`,`createTime`) VALUES (?);',
			[[session,userId,new Date()]],
			function(error,result){
				if(error) throw error;
				callback(session);
			}
		);
	}
	/*
		- field		String
			- userId
			- username
			- email
		- value		Mixed
		- callback	Function
			- result	Object or Null
	*/
	db.getUserData=function(field,value,callback){
		if(['userId','username','email'].indexOf(field)===-1)
			throw error;
		pool.query('SELECT * FROM `user` WHERE ??=?;',[field,value],function(error,result){
			if(error) throw error;
			callback(result.length? result[0]:null);
		});
	}
	/*
		- session	Buffer
		- callback	Function
			- result	Object or Null
	*/
	db.getSession=function(session,callback){
		pool.query('SELECT * FROM `session` WHERE `session`=?;',[session],function(error,result){
			if(error) throw error;
			callback(result.length? result[0]:null);
		});
	}
	/*
		- session	Buffer
		- callback	Function
	*/
	db.removeSession=function(session,callback){
		pool.query('DELETE FROM `session` WHERE `session`=?;',[session],function(error,result){
			if(error) throw error;
			callback();
		});
	}
	/*
		- session	Buffer
		- messageId	Number	(option)
		- callback	Function
	*/
	db.updateSession=function(session,messageId,callback){
		if(!callback){
			callback=messageId;
			let sql='UPDATE `session` SET `lastTime`=? WHERE `session`=?;';
			let args=[new Date(),session];
		}else{
			let sql='UPDATE `session` SET `messageId`=?,`lastTime`=? WHERE `session`=?;';
			let args=[messageId,new Date(),session];
		}
		pool.query(sql,args,function(error,result){
			if(error) throw error;
			if(result.changeRows)
				callback();
			else
				throw new Error('session not exists');
		});
	}
	/*
		- userId	Number
		- userData	Object
			- password		Buffer	(option)
			- email			String	(option)
			- active		Boolean	(option)
			- actionGroup	String	(option)
		- callback	Function
	*/
	db.updateUserData=function(userId,userData,callback){
		let allowChangeField=['password','email','active','actionGroup'];
		for(let field in userData){
			if(allowChangeField.indexOf(field)===-1)
				throw new Error('userData have not allow field');
		}
		pool.query('UPDATE `user` SET ? WHERE `userId`=?;',[userData,userId],function(error,result){
			if(error) throw error;
				callback();
		});
	}
})(db);

/* Chat Log */
(function(db){
	var chatLogCache=[];
	var writingCount=0;
	var writeTTL=setTimeout(db.writeChatLogNow,config.chatLogCacheTTL);
	
	db.writeChatLog=function(time,type,channelId,fromUserId,toUserId,msg){
		var at=0;
		while(at<msg.length){
			chatLogCache.push([time,type,channelId,fromUserId,toUserId,msg.substr(at,255)]);
			at+=255;
		}
		db.writeChatLogNow();
	}
	db.writeChatLogNow=function(force){
		if(chatLogCache.length<config.chatLogCacheCount && !force) return;
		clearTimeout(writeTTL);
		writeTTL=setTimeout(db.writeChatLogNow,config.chatLogCacheTTL);
		var waitWrite=chatLogCache.splice(0,config.chatLogCacheCount);
		if(!waitWrite.length) return;
		writingCount+=waitWrite.length;
		pool.query(
			'INSERT INTO `chatlog` (`time`,`type`,`channelId`,`fromUserId`,`toUserId`,`message`) VALUES ?;',
			[waitWrite],
			function(error,result){
				writingCount-=waitWrite.length;
				if(error){
					console.error('無法寫入聊天記錄，錯誤: %j',error);
					chatLogCache.unshift.apply(chatLogCache,waitWrite);
					waitWrite=[];
				}
			}
		);
		if(force && chatLogCache.length)
			db.writeChatLogNow(force);
	}
	db.chatLogCacheCount=function(){
		return chatLogCache.length+writingCount;
	}
})(db);

module.exports=db;