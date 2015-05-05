'use strict';
var Crypto=require('crypto');
var ActionGroup;
setImmediate(function(){//迴避互相依賴
	ActionGroup=require('./ActionGroup.js');
});
var DB=require('./DB.js');
var Config=require('./Config.js');
const controlChars=/[\x00-\x1f\x7f]/;
const usernameMaxLength=20;//帳號長度上限
const profileFieldCheck={//可修改個人資料的檢查正規式
	'email': /^[a-z0-9]+(?:(?:\+|\.)[a-z0-9]+)*@(?:[a-z0-9][a-z0-9-]*[a-z0-9])+(?:\.[a-z]{2,5}){1,2}$/i,
	'password': /^.{32,}$/,	//限制密碼預加密的最短長度
	'newPassword': /^.{32,}$/	//同上，改密碼用
};
const saltLength=8;//salt 長度
const saltChar='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`-=[];’,./~!@#$%^&*()_+{}|:”<>?\\';//salt 字元

function User(link){
	this.userId=null;
	this.username=null;
	this.link=link;
	this.channel=null;
	this.actionGroup=new ActionGroup.Auth(this);
	
	var _=this;
	link
		.on('error',function(error){
			console.log('User Error: %s',error);
		})
		.on('close',function(){
			_.exit();
		})
		.on('message',function(data){
			_.actionGroup.exec(data);
		})
	;
	
	User.userList.push(this);
	User.userIndex_userId.push(this.userId);
}
User.userIndex_userId=[];
User.userList=[];
/*
	成功，返回userData
	0=系統錯誤
	-1=帳號不合法
	-2=驗證失敗
	-3=帳號停用中
*/
User.auth=function(username,password,callback){
	if(User.checkInfoFormat({'username': username})){
		callback(-1); return;
	}
	DB.getUserInfoByUsername(username,function(error,result){
		if(error){
			console.error(error);
			callback(0);
			return;
		}
		if(!result.length){
			callback(-2);
			return;
		}
		result=result[0];
		if(result.password==passwordHash(password,result.salt)){
			if(result.active) callback(result);
			else callback(-3);
		}else
			callback(-2);
	});
}
/*
	0=沒有問題
	1=帳號不合法
	2=信箱不合法
	3=密碼不合法
*/
User.checkInfoFormat=function(info){
	if(info.hasOwnProperty('username') && (!info.username.length || info.username.length>usernameMaxLength || controlChars.test(info.username)))
		return 1;
	if(info.hasOwnProperty('email') && (!profileFieldCheck.email.test(info.email)))
		return 2;
	if(info.hasOwnProperty('password') && (!profileFieldCheck.password.test(info.password)))
		return 3;
}
/*
	0<成功，返回userId
	0=系統錯誤
	-1=帳號不合法
	-2=信箱不合法
	-3=密碼不合法
	-11=帳號已存在
	-12=信箱已存在
*/
User.register=function(username,password,email,callback){
	var checkInfo=User.checkInfoFormat({
		'username': username,
		'password': password,
		'email': email
	});
	if(!checkInfo){
		callback(-checkInfo);
		return;
	}
	DB.checkUserExists(username,email,function(error,result){
		if(error){
			console.error(error);
			callback(0); return;
		}
		if(result.length){
			if(result[0].username==username)
				callback(-4);
			else if(result[1].email==email)
				callback(-5);
			return;
		}
		var salt=genSalt();
		var password=passwordHash(password,salt);
		DB.createUser(
			{
				'username': username,
				'password': password,
				'salt': salt,
				'email': email,
				'active': true,
				'regTime': Math.floor(new Date().getTime()/1000)
			},
			function(error,result){
				if(error) console.error(error);
				callback(error? 0:result.insertId);
			}
		);
	})
}
/*
	0=成功
	-1=系統錯誤
	-2=目標不存在
*/
User.resetPassword=function(userId,callback){
	var salt=genSalt();
	var password=(Math.floor(Math.random()*Math.pow(36,8))).toString(36);
	DB.updateUserInfo(userId,{
		'password': passwordHash(password,salt)
	},function(error,result){
		if(error){
			callback(-1);
		}else if(result.changedRows){
			callback(0,password);
		}else{
			callback(-2);
		}
	});
}
User.findById=function(userId){
	var index=this.userIndex_userId.indexOf(userId);
	return index>=0? this.userList[index]:null;
}
User.send=function(data){
	if(!(Buffer.isBuffer(data) || typeof(data)==='string'));
		data=JSON.stringify(data);
	this.userList.forEach(function(user){
		user.send(data);
	});
}
User.exit=function(code){
	this.userList.forEach(function(user){
		user.exit(code);
	});
	return this;
}
User.prototype.exit=function(code){
	if(this.link.connected) this.link.close(code);
	if(this.channel) this.channel.exit(this);
	this.actionGroup.umount();
	var index=User.userList.indexOf(this);
	if(index>=0){
		User.userIndex_userId.splice(index,1);
		User.userList.splice(index,1);
	}
	return true;
}
User.prototype.profile=function(data,callback){
	var _=this;
	if(data){//待補上修改E-mail後重新驗證
		User.auth(this.username,data.password,function(result){
			if(!result || result<0){
				callback(null,false);
				return;
			}
			for(var field in data){
				if(!profileFieldCheck.hasOwnProperty(field) || !profileFieldCheck[field].test(data[field])){
					callback(null,false);
					return;
				}
			}
			if(data.hasOwnProperty('newPassword')){
				var salt=getSalt();
				data.password=passwordHash(data.newPassword,salt);
				data.salt=salt;
				delete data.newPassword;
			}else{
				delete data.password;
			}
			DB.updateUserInfo(
				_.userId,
				data,
				function(error,result){
					if(error)
						callback(true,false);
					else
						callback(null,true);
				}
			);
		});
	}else{
		DB.getUserInfoById(this.userId,function(error,result){
			if(error){
				callback(true,null);
				return;
			}
			result.password=result.salt=result.action=undefined;
			callback(null,result[0]);
		});
	}
}
User.prototype.send=function(data){
	if(!this.link.connected) return false;
	if(Buffer.isBuffer(data))
		this.link.sendBytes(data);
	else
		this.link.sendUTF(typeof(data)==='string'? data:JSON.stringify(data));
	return true;
}
User.prototype.updateId=function(userId){
	this.userId=userId;
	User.userIndex_userId[User.userList.indexOf(this)]=userId;
}

function passwordHash(password,salt){
	return Crypto.createHash(Config.userPasswordHash).update(salt).update(password).digest('hex');
}
function genSalt(){
	var salt='';
	while(salt.length<saltLength){
		salt+=saltChar.charAt(Math.floor(Math.random()*saltChar.length));
	}
	return salt;
}

module.exports=User;