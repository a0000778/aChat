'use strict';
var debug=require('util').debuglog('httpApi');
var domainCreate=require('domain').create;
var formidable=require('formidable');
var router=require('light-router');
var nodemailer=require('nodemailer');
var util=require('util');
var Config=require('./Config.js');
var DB=require('./DB.js');
var User=require('./User.js');

const codeChar='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
var codeList=new Map();
var codeListClear=setInterval(clearCode,60000);
var mailer=nodemailer.createTransport(Config.mailer);

router.options('/v1/forgotPassword',allowPost);
router.post('/v1/forgotPassword',function(req,res){
	new formidable({
		'maxFieldsSize': 512,
		'maxFields': 1,
	}).parse(req,function(error,fields,files){
		if(error || !fields.hasOwnProperty('email')){
			res.writeHead(400);
			res.end();
			return;
		}
		DB.getUserInfoByEmail(fields.email,function(error,result){
			if(error){
				res.writeHead(500);
				res.end();
				return;
			}
			res.writeHead(200);
			res.end();
			result=result[0];
			if(!result){
				debug('[/v1/forgotPassword] %s 不存在',fields.email);
				return;
			}
			var code=genCode(42);
			var resetInfo={
				'action': 'resetPassword',
				'timeout': Math.floor(Date.now()/1000)+Config.mailTimeout,
				'userId': result.userId,
				'username': result.username
			};
			var mailTemplate=Config.mailTemplate.forgotPassword;
			var mailArgs={
				'username': result.username,
				'code': code
			};
			mailer.sendMail({
				'from': Config.mailSender,
				'to': result.email,
				'subject': renderTemplate(mailTemplate.subject,mailArgs),
				'text': renderTemplate(mailTemplate.contentText,mailArgs),
				'html': renderTemplate(mailTemplate.contentHTML,mailArgs)
			});
			codeList.set(code,resetInfo);
			debug('[/v1/forgotPassword] code %s: %j',code,resetInfo);
		});
	});
});
router.options('/v1/resetPassword',allowPost);
router.post('/v1/resetPassword',function(req,res){
	new formidable({
		'maxFieldsSize': 512,
		'maxFields': 1,
	}).parse(req,function(error,fields,files){
		if(error || !fields.hasOwnProperty('code')){
			res.writeHead(400);
			res.end();
			return;
		}
		var actionInfo=codeList.get(fields.code);
		if(!actionInfo || actionInfo.action!='resetPassword'){
			res.writeHead(200);
			res.end('not exists');
			debug('[/v1/resetPassword] code %s: 不存在',fields.code);
			return;
		}
		codeList.delete(fields.code);
		User.resetPassword(actionInfo.userId,function(result,password){
			switch(result){
				case 0:
					res.writeHead(200);
					res.end('OK');
					var mailTemplate=Config.mailTemplate.resetPassword;
					var mailArgs={
						'username': actionInfo.username,
						'password': password
					};
					mailer.sendMail({
						'from': Config.mailCheckSender,
						'to': result.email,
						'subject': renderTemplate(mailTemplate.subject,mailArgs),
						'text': renderTemplate(mailTemplate.contextText,mailArgs),
						'html': renderTemplate(mailTemplate.contextHTML,mailArgs)
					});
					debug('[/v1/resetPassword] code %s: %j',fields.code,mailArgs);
				break;
				case -2:
					res.writeHead(200);
					res.end('not exists');
					debug('[/v1/resetPassword] code %s: userId %d 不存在',fields.code,actionInfo.userId);
				break;
				case -1:
					res.writeHead(500);
					res.end();
				break;
			}
		});
	});
});
router.options('/v1/register',allowPost);
router.post('/v1/register',function(req,res){
	new formidable({
		'maxFieldsSize': 1024,
		'maxFields': 3,
	}).parse(req,function(error,fields,files){
		if(error || !(
			fields.hasOwnProperty('username')
			&& fields.hasOwnProperty('email')
			&& fields.hasOwnProperty('password')
		)){
			res.writeHead(400);
			res.end();
			return;
		}
		DB.checkUserExists(fields.username,fields.email,function(error,result){
			if(error){
				res.writeHead(500);
				res.end();
				return;
			}
			if(result.length){
				if(result[0].username==fields.username){
					res.end('username');
					debug('[/v1/register] 帳號 %s 已存在',fields.username);
				}else if(result[0].email==fields.email){
					res.end('email');
					debug('[/v1/register] 信箱 %s 已存在',fields.email);
				}
				return;
			}
			var code=genCode(42);
			var resetInfo={
				'action': 'register',
				'timeout': Math.floor(Date.now()/1000)+Config.mailTimeout,
				'username': fields.username,
				'email': fields.email,
				'password': fields.password
			};
			var mailTemplate=Config.mailTemplate.checkMail;
			var mailArgs={
				'username': fields.username,
				'code': code
			};
			mailer.sendMail({
				'from': Config.mailSender,
				'to': fields.email,
				'subject': renderTemplate(mailTemplate.subject,mailArgs),
				'text': renderTemplate(mailTemplate.contentText,mailArgs),
				'html': renderTemplate(mailTemplate.contentHTML,mailArgs)
			});
			codeList.set(code,resetInfo);
			res.writeHead(200);
			res.end('OK');
			debug('[/v1/register] 等待信箱驗證: %j',resetInfo);
		});
	});
});
router.options('/v1/mail',allowPost);
router.post('/v1/mail',function(req,res){
	new formidable({
		'maxFieldsSize': 512,
		'maxFields': 3,
	}).parse(req,function(error,fields,files){
		if(error || !fields.hasOwnProperty('code')){
			res.writeHead(400);
			res.end();
			return;
		}
		if(!codeList.has(fields.code)){
			res.writeHead(200);
			res.end('not exists');
			return;
		}
		var actionInfo=codeList.get(fields.code);
		codeList.delete(fields.code);
		switch(actionInfo.action){
			case 'register':
				User.register(actionInfo.username,actionInfo.password,actionInfo.email,function(result){
					switch(result){
						case 0:
							res.writeHead(500);
							res.end();
						break;
						case -1:
						case -2:
						case -3:
							console.error('[HTTP] /v1/mail，操作 register 於已檢查的資料被確認出不合法！')
							res.writeHead(500);
							res.end();
						break;
						case -11:
							res.writeHead(200);
							res.end('username');
						break;
						case -12:
							res.writeHead(200);
							res.end('email');
						break;
						default:
							res.writeHead(200);
							res.end('OK');
					}
				});
			break;
			default:
				console.error('[HTTP] /v1/mail 未知的操作 %s',actionInfo.action);
				res.writeHead(500);
			res.end();
		}
	});
});
if(process.env.NODE_DEBUG) router.get('/v1/status',function(req,res){
	res.setHeader('Content-Type','text/plain; charset=utf-8');
	
	res.write(util.format('在線人數: %d / %d\n',User.userList.length,Config.userMax));
	res.write(util.format('記憶體: %d KB\n',Math.ceil(process.memoryUsage().rss/1024)));
	res.write(util.format('記錄寫入快取: %d\n',DB.chatLogCacheCount()));
	
	res.write(util.format('\n驗證代碼列表: (共計 %d 筆)\n',codeList.size));
	for(let code of codeList){
		res.write(util.format(
			'%s: action=%s, username=%s, timeout=%s\n',
			code[0],
			code[1].action,
			code[1].username,
			new Date(code[1].timeout*1000).toLocaleString()
		));
	}
	
	res.end();
});

function clearCode(){
	var now=Math.floor(Date.now()/1000);
	codeList.forEach(function(info,key){
		if(key.timeout<now)
			codeList.delete(key);
	});
}
function genCode(len){
	var code='';
	while(code.length<len)
		code+=codeChar.charAt(Math.floor(Math.random()*codeChar.length));
	return code;
}
function renderTemplate(template,args){
	if(!template) return undefined;
	return template.replace(/\{([a-zA-Z0-9_]+)\}/g,function(find,tag){
		return args.hasOwnProperty(tag)? args[tag]:find;
	});
}
function allowPost(req,res){
	res.setHeader('Access-Control-Allow-Headers','Content-Type');
	res.setHeader('Access-Control-Allow-Methods','OPTIONS, POST');
	res.setHeader('Access-Control-Max-Age',86400);
	res.end();
}

module.exports=function(req,res){
	let domain=domainCreate();
	domain.add(req);
	domain.add(res);
	domain.on('error',function(error){
		debug(error);
		res.socket.destroy();
	});
	domain.enter();
	
	if(req.headers['origin']) res.setHeader('Access-Control-Allow-Origin',req.headers['origin']);
	router(req,res);
	
	domain.exit();
};