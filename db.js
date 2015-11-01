'use strict';
let crypto=require('crypto');
let mysql=require('mysql');
let config=require('./config.js');

let pool=mysql.createPool(config.mysql);
let db={};

Object.defineProperty(db,'queryQueueCount',{
	'get': () => pool._allConnections.length-pool._freeConnections.length+pool._connectionQueue.length
});

/* Channel */
{
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
		pool.query('UPDATE `channel` SET `name`=? WHERE `channelId`=?;',[newName,channelId],function(error,result){
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
};

/* User */
{
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
		let session=crypto.randomBytes(20);
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
		- userId	Number
		- callback	Function
			- result	Array
				- session	Object
					- session		Buffer
					- createTime	Date
					- lastClient	String
					- lastLogin		Date
	*/
	db.getUserSession=function(userId,callback){
		pool.query(
			'SELECT `session`,`createTime`,`lastClient`,`lastLogin` FROM `session` WHERE `userId`=?',
			[userId],
			function(error,result){
				if(error) throw error;
				callback(result);
			}
		);
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
			callback && callback();
		});
	}
	/*
		- session		Buffer
		- updateData	Object	(option)
			- messageId		Number	(option)
			- lastClient	String	(option)
		- callback		Function
	*/
	db.updateSession=function(session,updateData,callback){
		let sql,args;
		if(!callback){
			callback=updateData;
			sql='UPDATE `session` SET `lastLogin`=? WHERE `session`=?;';
			args=[new Date(),session];
		}else{
			sql='UPDATE `session` SET ';
			args=[];
			for(let field in updateData){
				if(field==='messageId' || field==='lastClient'){
					sql+='??=?,';
					args.push(field,updateData[field]);
				}else
					throw new Error('not allow field');
			}
			sql+='`lastLogin`=? WHERE `session`=?;';
			args.push(new Date(),session);
		}
		pool.query(sql,args,function(error,result){
			if(error) throw error;
			callback && callback();
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
};

/* Chat Log */
{
	const cacheMessageFilter={
		'startMessageId': (filter,message) => message[0]>=filter.startMessageId,
		'startTime': (filter,message) => message[1]>filter.startTime,
		'endTime': (filter,message) => message[1]<filter.endTime,
		'userId': (filter,message) => filter.userId===message[4] || filter.userId===message[5],
		'userId_IN': (filter,message) => filter.userId.indexOf(message[4])!==-1 || filter.userId===message[5],
		'toUserIdIsNull': (filter,message) => message[5]===null,//去除指向性廣播用
		'channelId': (filter,message) => filter.channelId===message[3],
		'channelId_IN': (filter,message) => filter.channelId.indexOf(message[3])!==-1,
		'type': (filter,message) => filter.type===message[2],
		'type_IN': (filter,message) => filter.type.indexOf(message[2])!==-1
	}
	let chatLogCache=[];
	let writingCache=0;
	let lastMessageId=0;
	let writeTTL;
	
	db.getChatLog=function(filter,each,callback){
		const fields=['startMessageId','startTime','endTime','userId','channelId','type','limit'];
		filter=filter || {};
		let cacheSnapshot=chatLogCache.slice();
		let resultLimit=Number.Infinity;
		let where=[];
		let limit='';
		let args=[];
		if(!Object.keys(filter).every((key) => fields.indexOf(key)!==-1))
			throw new Error('filter have not allow field');
		typeof(filter.startMessageId)!='undefined' && where.push('`messageId`>=?') && args.push(filter.startMessageId);
		typeof(filter.startTime)!='undefined' && where.push('`time`>?') && args.push(filter.startTime);
		typeof(filter.endTime)!='undefined' && where.push('`time`<?') && args.push(filter.endTime);
		typeof(filter.userId)!='undefined' && where.push('(`fromUserId`'+sql_isOrIn(filter.userId)+' OR `toUserId`'+sql_isOrIn(filter.userId)+')') && args.push(filter.userId,filter.userId);
		typeof(filter.userId)=='undefined' && where.push('`toUserId` IS NULL');//去除指向性廣播用
		typeof(filter.channelId)!='undefined' && where.push('`channelId`'+sql_isOrIn(filter.channelId)) && args.push(filter.channelId);
		typeof(filter.type)!='undefined' && where.push('`type`'+sql_isOrIn(filter.type)) && args.push(filter.type);
		filter.limit>0 && (resultLimit=filter.limit) && (limit=' LIMIT ?') && args.push(filter.limit);
		pool.query(
			'SELECT * FROM `chatlog`'+(where.length? ' WHERE '+where.join(' AND '):'')+limit+';',
			args
		)
			.on('result',function(message){
				resultLimit--;
				each(message);
			})
			.on('end',function(){
				if(resultLimit>0){
					filter.limit=resultLimit;
					queryCache(filter,cacheSnapshot,each,callback);
				}else
					callback();
			})
		;
	}
	db.writeChatLog=function(time,type,channelId,fromUserId,toUserId,msg){
		let at=0;
		while(at<msg.length){
			chatLogCache.push([++lastMessageId,time,type,channelId,fromUserId,toUserId,msg.substr(at,255)]);
			at+=255;
		}
		db.writeChatLogNow();
	}
	db.writeChatLogNow=function(force){
		if(chatLogCache.length<config.chatLogCacheCount && !force) return;
		clearTimeout(writeTTL);
		writeTTL=setTimeout(db.writeChatLogNow,60000,true);
		if(chatLogCache.length && !writingCache) writeChatLog(force);
	}
	db.chatLogCacheCount=function(){
		return chatLogCache.length;
	}
	function queryCache(filter,snapshot,each,callback){
		snapshot=snapshot.entries();
		let filterBuild=[];
		typeof(filter.startMessageId)!='undefined' && filterBuild.push(cacheMessageFilter.startMessageId);
		typeof(filter.startTime)!='undefined' && filterBuild.push(cacheMessageFilter.startTime);
		typeof(filter.endTime)!='undefined' && filterBuild.push(cacheMessageFilter.endTime);
		typeof(filter.userId)!='undefined' && filterBuild.push(Array.isArray(filter.userId)? cacheMessageFilter.userId_IN:cacheMessageFilter.userId);
		typeof(filter.userId)=='undefined' && filterBuild.push(cacheMessageFilter.toUserIdIsNull);//去除指向性廣播用
		typeof(filter.channelId)!='undefined' && filterBuild.push(Array.isArray(filter.channelId)? cacheMessageFilter.channelId_IN:cacheMessageFilter.channelId);
		typeof(filter.type)!='undefined' && filterBuild.push(Array.isArray(filter.type)? cacheMessageFilter.type_IN:cacheMessageFilter.type);
		let limit=filter.limit || Number.Infinity;
		for(let message of snapshot){
			message=message[1];
			if(filterBuild.every((messageFilter) => messageFilter(filter,message))){
				each(message);
				if(!--limit) break;
			}
		}
		callback();
	}
	function writeChatLog(force){
		writingCache=Math.min(chatLogCache.length,config.chatLogCacheCount);
		pool.query(
			'INSERT INTO `chatlog` (`messageId`,`time`,`type`,`channelId`,`fromUserId`,`toUserId`,`message`) VALUES ?;',
			[chatLogCache.slice(0,writingCache)],
			function(error,result){
				if(error){
					console.error('無法寫入聊天記錄，錯誤: %j',error);
				}else{
					chatLogCache.splice(0,writingCache);
				}
				writingCache=0;
				if(chatLogCache.length && (force || chatLogCache.length>=config.chatLogCacheCount))
					writeChatLog(force);
			}
		);
	}
	
	pool.query('SELECT `messageId` FROM `chatlog` ORDER BY `messageId` DESC LIMIT 1;',function(error,result){
		if(error){
			console.error('無法確認最後的聊天記錄編號！');
			throw error;
		}
		if(result.length)
			lastMessageId=result[0].messageId;
	});
	writeTTL=setTimeout(db.writeChatLogNow,60000,true);
}

function sql_isOrIn(value){
	return (Array.isArray(value) && value.length!==1)? ' IN (?)':'=?';
}

module.exports=db;