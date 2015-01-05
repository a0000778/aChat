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
	this.id=null;
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
	User.userIndexId.push(this.id);
}
User.userIndexId=[];
User.userList=[];
/*
	成功，返回userData
	0=系統錯誤
	-1=帳號不合法
	-2=驗證失敗
	-3=帳號停用中
*/
User.auth=function(username,password,callback){
	if(!username.length || username.length>usernameMaxLength || controlChars.test(username)){
		setImmediate(callback,-1); return;
	}
	DB.getUserInfoByUsername(username,function(error,result){
		if(error){
			console.error(error);
			setImmediate(callback,0);
			return;
		}
		if(!result.length){
			setImmediate(callback,-2);
			return;
		}
		result=result[0];
		if(result.password==passwordHash(password,result.salt))
			setImmediate(callback,result);
	});
}
/*
	0<成功，返回userId
	0=系統錯誤
	-1=帳號不合法
	-2=信箱不合法
	-3=密碼不合法
	-4=帳號已存在
*/
User.register=function(username,password,email,callback){
	if(!username.length || username.length>usernameMaxLength || controlChars.test(username)){
		setImmediate(callback,-1);
		return;
	}
	if(!profileFieldCheck.email.test(email)){
		setImmediate(callback,-2);
		return;
	}
	if(!profileFieldCheck.password.test(password)){
		setImmediate(callback,-3);
		return;
	}
	DB.getUserInfoByUsername(username,function(error,result){
		if(error){
			console.error(error);
			setImmediate(callback,0); return;
		}
		if(result.length){
			setImmediate(callback,-4); return;
		}
		var salt=genSalt();
		var password=passwordHash(password,salt);
		DB.createUser(
			{
				'username': username,
				'password': password,
				'salt': salt,
				'email': email,
				'action': true,
				'regTime': Math.floor(new Date().getTime()/1000)
			},
			function(error,result){
				if(error) console.error(error);
				setImmediate(callback,error? 0:result.insertId);
			}
		);
	})
}
User.findById=function(id){
	var index=this.userIndexId.indexOf(id);
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
	var index=User.userList.indexOf(this);
	if(index>=0)
		User.userList.splice(index,1);
	return true;
}
User.prototype.profile=function(data,callback){
	if(data){//待補上修改E-mail後重新驗證
		User.auth(this.username,data.password,function(result){
			if(!result || result<0){
				setImmediate(callback,null,false);
				return;
			}
			for(var field in data){
				if(!profileFieldCheck.hasOwnProperty(field) || !profileFieldCheck[field].test(data[field])){
					setImmediate(callback,null,false);
				}
			}
			if(data.hasOwnProperty('newPassword')){
				var salt=getSalt();
				data.password=passwordHash(data.newPassword,salt);
				data.salt=salt;
				data.newPassword=undefined;
			}else{
				data.password=undefined;
			}
			DB.updateUserInfo(
				this.id,
				data,
				function(error,result){
					if(error)
						setImmediate(callback,true,false);
					else
						setImmediate(callback,null,true);
				}
			);
		});
	}else{
		DB.getUserInfoById(this.id,function(error,result){
			if(error){
				setImmediate(callback,true,null);
				return;
			}
			result.password=result.salt=result.action=undefined;
			setImmediate(callback,result[0]);
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
User.prototype.updateId=function(id){
	this.id=id;
	User.userIndexId[User.userList.indexOf(this)]=id;
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