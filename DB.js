var mysql=require('mysql');
var Config=require('./Config.js');

var pool=mysql.createPool(Config.DBConnect);
var DB={};

/* Channel */
(function(DB){
	DB.getAllChannel=function(callback){
		pool.query('SELECT * FROM `channel`;',[],callback);
	}
	DB.createChannel=function(config,callback){
		pool.query('INSERT INTO `channel` (`name`) VALUES (?);',[[config.name]],callback);
	}
	DB.editChannel=function(channelId,config,callback){
		pool.query('UPDATE `channel` SET `name`=? WHERE `channelId`=?;',[config.name,channelId],callback);
	}
	DB.deleteChannel=function(channelId,callback){
		pool.query('DELETE FROM `channel` WHERE `channelId`=?;',[channelId],callback);
	}
})(DB);

/* E-mail */
(function(DB){
	DB.createEmailCheck=function(hash,userId,type,args,callback){
		pool.query(//type 及 args 記錄此封驗證作用，更新email、重設密碼等
			'INSERT INTO `emailCheck` (`hash`,`userId`,`type`,`args`) VALUES (?,?,?,?);',
			[hash,userId,type,args],
			callback
		);
	}
	DB.getEmailCheck=function(hash,callback){
		pool.query('select * FROM `emailCheck` WHERE `hash`=?;',[hash],callback);
	}
})(DB);

/* User */
(function(DB){
	DB.createUser=function(info,callback){
		pool.query(
			'INSERT INTO `user` (`username`,`password`,`salt`,`email`,`action`,`regTime`) VALUES (?);',
			[[info.username,info.password,info.salt,info.email,info.action,info.regTime]],
			callback
		);
	}
	DB.getUserInfoById=function(userId,callback){
		pool.query('SELECT * FROM `user` WHERE `userId`=?',[userId],callback);
	}
	DB.getUserInfoByUsername=function(username,callback){
		pool.query('SELECT * FROM `user` WHERE `username`=?',[username],callback);
	}
	DB.updateUserInfo=function(userId,info,callback){
		pool.query('UPDATE `user` SET ? WHERE `userId`=?;',[info,userId],callback);
	}
})(DB);

/* Chat Log */
(function(DB){
	var chatLogCache=[];
	var writingCount=0;
	var writeTTL=setTimeout(DB.writeChatLogNow,Config.chatLogCacheTTL);
	
	DB.writeChatLog=function(time,type,channelId,fromUserId,toUserId,msg){
		var at=0;
		while(at<msg.length){
			chatLogCache.push([time,type,channelId,fromUserId,toUserId,msg.substr(at,255)]);
			at+=255;
		}
		DB.writeChatLogNow();
	}
	DB.writeChatLogNow=function(force){
		if(chatLogCache.length<Config.chatLogCacheCount && !force) return;
		clearTimeout(writeTTL);
		writeTTL=setTimeout(DB.writeChatLogNow,Config.chatLogCacheTTL);
		var waitWrite=chatLogCache.splice(0,Config.chatLogCacheCount);
		if(!waitWrite.length) return;
		writingCount+=waitWrite.length;
		pool.query(
			'INSERT INTO `chatlog` (`time`,`type`,`channelId`,`fromUserId`,`toUserId`,`message`) VALUES ?;',
			[waitWrite],
			function(error,result){
				writingCount-=waitWrite.length;
				if(error){
					console.error('無法寫入聊天記錄，錯誤: %s',error);
					chatLogCache.unshift.apply(chatLogCache,waitWrite);
					waitWrite=[];
				}
			}
		);
		if(force && chatLogCache.length)
			DB.writeChatLogNow(force);
	}
	DB.chatLogCacheCount=function(){
		return chatLogCache.length+writingCount;
	}
})(DB);

module.exports=DB;