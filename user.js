'use strict';
var actionGroup=require('./actionGroup.js');
var config=require('./config.js');
var crypto=require('crypto');
var db=require('./db.js');
var domainCreate=require('domain').create;
var util=require('util');

const fieldCheck={
	//資料庫欄位
	'userId': (userId) => Number.isSafeInteger(userId) && userId>0,
	'username': (username) => typeof(username)==='string' && /^[^\x00-\x1f\x7f]{1,20}$/.test(username),
	'email': (email) => typeof(email)==='string' && /^[a-z0-9]+(?:(?:\+|\.)[a-z0-9]+)*@(?:[a-z0-9][a-z0-9-]*[a-z0-9])+(?:\.[a-z]{2,5}){1,2}$/i.test(email),
	'password': (password) => Buffer.isBuffer(password) && password.length===32,
	'active': (active) => typeof(active)==='boolean',
	'actionGroup': (name) => typeof(name)==='string' && actionGroup.hasOwnProperty(name),
	'session': (session) => Buffer.isBuffer(session) && session.length===20,
	//臨時資料
	'question': (question) => Buffer.isBuffer(question) && question.length>7,
	'answer': (answer) => Buffer.isBuffer(answer) && answer.length===32
};
var user={};
var userListById=new Map();
var userListByUsername=new Map();
var sessionList=new Set();

Object.defineProperty(user,'sessionCount',{
	'get': () => sessionList.size
});
Object.defineProperty(user,'userCount',{
	'get': () => userListById.size
});
user.fieldCheck=fieldCheck;
/*
	- username	String
	- question	Buffer
	- answer	Buffer
	- callback	Function
		- result	Object or String
			- (Object)	成功
			- disabled	帳號被停用
			- fail		失敗
*/
user.authByPassword=function(username,question,answer,callback){
	if(!(fieldCheck.username(username) && fieldCheck.question(question) && fieldCheck.answer(answer)))
		throw new Error('field format error');
	db.getUserData('username',username,function(result){
		if(result && !Buffer.compare(passwordHmac(question,result.password),answer)){
			if(result.active)
				callback(result);
			else
				callback('disabled');
		}else
			callback('fail');
	});
}
/*
	- userId	Number
	- session	Buffer
	- link		Link
	- callback	Function
		- result	String
			- success	成功
			- disable	帳號被停用
			- fail		失敗
*/
user.authBySession=function(userId,session,link,callback){
	if(!(fieldCheck.userId(userId) && fieldCheck.session(session)))
		throw new Error('field format error');
	db.getSession(session,function(result){
		if(!result || result.userId!==userId)
			callback('fail');
		else if(userListById.has(userId)){
			if(userListById.get(userId).findSession(session))
				callback('repeat login');
			else
				db.updateSession(session,function(){
					link._setUser(session,userListById.get(userId));
					callback('success');
				});
		}else{
			db.getUserData('userId',userId,function(result){
				if(result){
					if(link.link.protocol=='adminv1' && result.actionGroup!='Admin'){
						callback('fail');
					}else if(result.active){
						db.updateSession(session,function(){
							link._setUser(session,userId,result.username,result.actionGroup);
							callback('success');
						});
					}else
						callback('disabled');
				}else{
					console.log('Unknown userId %d has session %s !',userId,session.toString('hex'));
					callback('fail');
				}
			});
		}
	});
}
/*
	- username	String
	- email		String
	- callback	Function
		- result
			- (String)	帳號或 E-mail 重複
			- (Number)	註冊成功，返回 userId
*/
user.checkExists=function(username,email,callback){
	if(!(fieldCheck.username(username) && fieldCheck.email(email)))
		throw new Error('field format error');
	db.checkUserExists(username,email,callback);
}
/*
	- link	WebSocketConnection
*/
user.createLink= (link) => new Link(link);
/*
	- userId	Number
	- callback	Function
		- session	Buffer
*/
user.createSession=function(userId,callback){
	if(!fieldCheck.userId(userId))
		throw new Error('field format error');
	db.createSession(userId,callback);
}
/*
	- username	String
	- password	Buffer
	- email		String
	- callback	Function
		- result
			- (String)	帳號或 E-mail 重複
			- (Number)	註冊成功，返回 userId
*/
user.createUser=function(username,password,email,callback){
	if(!(fieldCheck.username(username) && fieldCheck.password(password) && fieldCheck.email(email)))
		throw new Error('field format error');
	db.checkUserExists(username,email,function(result){
		if(result){
			callback(result);
			return;
		}
		db.createUser(username,password,email,true,callback);
	});
}
/*
	- code		Number
*/
user.exit=function(code){
	for(let session of sessionList.values())
		session.exit(code);
}
/*
	- data		Mixed
*/
user.send=function(data){
	if(typeof(data)!=='string')
		data=JSON.stringify(data);
	for(let u of userListById.values())
		u.send(data);
}
/*
	- field				String
		- userId
		- username
		- email
	- value				Mixed
	- allResultCallback	Function
		- result	Object or Null
	return User or Null
*/
user.findUser=function(field,value,allResultCallback){
	let ret;
	if(field=='userId' && fieldCheck.userId(value))
		ret=userListById.get(value);
	else if(field=='username' && fieldCheck.username(value))
		ret=userListByUsername.get(value);
	else if(field=='email' && fieldCheck.email(value))
		ret=null;
	else
		throw new Error('field format error');
	if(allResultCallback)
		db.getUserData(field,value,allResultCallback);
	return ret;
}
/*
	- userId	Number
	- callback	Function
		- result	Object
*/
user.getProfile=function(userId,callback){
	if(!fieldCheck.userId(userId))
		throw new Error('field format error');
	db.getUserData('userId',userId,function(result){
		delete result.password;
		callback(result);
	});
}
/*
	- userId	Number
	- callback	Function
		- result	(Array)
			- session	(Object)
				- session		(Buffer)
				- createTime	(Date)
				- lastClient	(String)
				- lastLogin		(Date)
*/
user.getSession=function(userId,callback){
	if(!fieldCheck.userId(userId))
		throw new Error('field format error');
	db.getUserSession(userId,callback);
}
user.listSession=function(){
	let list=[];
	for(let u of sessionList){
		list.push(u);
	}
	return list;
}
user.listUser=function(){
	let list=[];
	for(let u of userListById.values()){
		list.push(u);
	}
	return list;
}
/*
	- session	Buffer
	- callback	Function
*/
user.removeSession=function(session,callback){
	if(!fieldCheck.session(session))
		throw new Error('field format error');
	db.removeSession(session,callback);
}
/*
	- userId	Number
	- callback	Function
		- password	String
*/
user.resetPassword=function(userId,callback){
	var password=crypto.randomBytes(4).toString('hex');
	db.updateUserInfo(userId,{
		'password': passwordHash(password)
	},function(){
		callback(password);
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
user.updateProfile=function(userId,userData,callback){
	if(!fieldCheck.userId(userId))
		throw new Error('field format error');
	let fieldCount=0;
	for(let field in userData){
		if(
			['userId','username','session','question','answer'].indexOf(field)!==-1 || 
			!(fieldCheck.hasOwnProperty(field) && fieldCheck[field](userData[field]))
		)
			throw new Error('field format error');
		fieldCount++;
	}
	if(fieldCount)
		db.updateUserData(userId,userData,callback);
	else
		throw new Error('no update field');
}

function Link(link){
	var _=this;
	
	let domain=domainCreate();
	domain.add(this);
	domain.add(link);
	domain.on('error',function(error){
		console.error(
			'session=%s,userId=%d, %s',
			_.session? _.session.toString('hex'):'null',
			_.user? _.user.userId:'null',
			error.stack
		);
		_.exit(4003);
	});
	domain.enter();
	
	this.user=null;
	this.session=null;
	this.link=link;
	this.removeSession=false;
	this._question=null;
	var auth=new actionGroup.Auth(this);
	
	link
		.on('close',function(){
			_.exit();
		})
		.on('message',function(data){
			auth._exec(data,_);
		})
	;
	
	sessionList.add(this);
	
	domain.exit();
}
Link.prototype.exit=function(code){
	if(this.link.connected) this.link.close(code);
	if(this.user){
		this.user.sessions.delete(this.session.toString('hex'));
		this.user._offline();
	}
	sessionList.delete(this);
	if(this.session){
		if(this.removeSession)
			db.removeSession(this.session);
		else
			db.updateSession(this.session);
	}
}
Link.prototype.send=function(data){
	if(!this.link.connected) return false;
	if(Buffer.isBuffer(data))
		this.link.sendBytes(data);
	else
		this.link.sendUTF(typeof(data)==='string'? data:JSON.stringify(data));
	return true;
}
Link.prototype._setUser=function(session,userId,username,actionGroup){
	if(this.user) return;
	var _=this;
	this.session=session;
	if(userId instanceof User)
		this.user=userId;
	else
		this.user=new User(userId,username,actionGroup);
	this.user.sessions.set(session.toString('hex'),this);
	this.link
		.removeAllListeners('message')
		.on('message',function(data){
			_.user.actionGroup._exec(data,_);
		})
	;
}

function User(userId,username,actionGroupName){
	this.userId=userId;
	this.username=username;
	this.channel=null;
	this.actionGroup=new actionGroup[actionGroupName](this);
	this.sessions=new Map();
	
	userListById.set(this.userId,this);
	userListByUsername.set(this.username,this);
}
User.prototype._offline=function(){
	if(this.sessions.size) return;
	if(this.channel) this.channel.exit(this);
	this.actionGroup._umount();
	userListById.delete(this.userId);
	userListByUsername.delete(this.username);
}
User.prototype.exit=function(code){
	for(let session of this.sessions.values())
		session.exit(code);
}
User.prototype.findSession=function(session){
	return this.sessions.get(session.toString('hex'));
}
User.prototype.send=function(data){
	if(typeof(data)!=='string')
		data=JSON.stringify(data);
	for(let session of this.sessions.values())
		session.send(data);
}

function passwordHash(password){
	return crypto.createHash('sha256').update(
		crypto.createHash('md5').update(password).digest()
	).update(password).digest();
}
function passwordHmac(question,password){
	return crypto.createHmac('sha256',password).update(question).digest();
}

module.exports=Object.freeze(user);
