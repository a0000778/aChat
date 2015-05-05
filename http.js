'use strict';
var formidable=require('formidable');
var router=require('light-router');
var nodemailer=require('nodemailer');
var Config=require('./Config.js');
var DB=require('./DB.js');
var User=require('./User.js');

const codeChar='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
var codeList=new Map();
var codeListClear=setInterval(clearCode,60000);
var mailer=nodemailer.createTransport(Config.mailer);

router.post('/v1/forgotPassword',function(req,res){
	new formidable({
		'maxFieldsSize': 512,
		'maxFields': 1,
	}).parse(req,function(error,fields,files){
		if(error || !fields.hasOwnProperty('email')){
			res.writeHead(400).end();
			return;
		}
		DB.getUserInfoByEmail(fields.email,function(error,result){
			if(error){
				res.writeHead(500).end();
				return;
			}
			result=result[0];
			if(!result) return;
			var code=genCode(42);
			var resetInfo={
				'action': 'resetPassword',
				'timeout': Math.floor(Date.now()/1000)+Config.mailCheckTimeout,
				'userId': result.userId,
				'username': result.username
			};
			var mailTemplate=Config.mailTemplate.forgotPassword;
			var mailArgs={
				'username': result.username,
				'code': code
			};
			mailer.sendMail({
				'from': Config.mailCheckSender,
				'to': result.email,
				'subject': renderTemplate(mailTemplate.subject,mailArgs),
				'text': renderTemplate(mailTemplate.contextText,mailArgs),
				'html': renderTemplate(mailTemplate.contextHTML,mailArgs)
			});
			codeList.set(code,resetInfo);
			res.writeHead(200).end();
		});
	});
});
router.post('/v1/resetPassword',function(req,res){
	new formidable({
		'maxFieldsSize': 512,
		'maxFields': 1,
	}).parse(req,function(error,fields,files){
		if(error || !fields.hasOwnProperty('code')){
			res.writeHead(400).end();
			return;
		}
		var actionInfo=codeList.get(fields.code);
		if(!actionInfo || actionInfo.action!='resetPassword'){
			res.writeHead(200).end('not exists');
			return;
		}
		codeList.delete(fields.code);
		User.resetPassword(actionInfo.userId,function(result,password){
			switch(result){
				case 0:
					res.writeHead(200).end('OK');
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
				break;
				case -2:
					console.error('[HTTP] /v1/resetPassword 重設不存在的使用者的密碼');
				case -1:
					res.writeHead(500).end();
				break;
			}
		});
	});
});
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
			res.writeHead(400).end();
			return;
		}
		DB.checkUserExists(fields.username,fields.email,function(error,result){
			if(error){
				res.writeHead(500).end();
				return;
			}
			if(result.length){
				if(result[0].username==fields.username){
					res.end('username');
				}else if(result[0].email==fields.email){
					res.end('email');
				}
				return;
			}
			var code=genCode(42);
			var resetInfo={
				'action': 'register',
				'timeout': Math.floor(Date.now()/1000)+Config.mailCheckTimeout,
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
				'from': Config.mailCheckSender,
				'to': result.email,
				'subject': renderTemplate(mailTemplate.subject,mailArgs),
				'text': renderTemplate(mailTemplate.contextText,mailArgs),
				'html': renderTemplate(mailTemplate.contextHTML,mailArgs)
			});
			codeList.set(code,resetInfo);
			res.writeHead(200).end('OK');
		});
	});
});
router.post('/v1/mail',function(req,res){
	new formidable({
		'maxFieldsSize': 512,
		'maxFields': 3,
	}).parse(req,function(error,fields,files){
		if(error || !fields.hasOwnProperty('code')){
			res.writeHead(400).end();
			return;
		}
		if(!codeList.has(fields.code)){
			res.writeHead(200).end('not exists');
			return;
		}
		var actionInfo=codeList.get(fields.code);
		codeList.delete(fields.code);
		switch(actionInfo.action){
			case 'register':
				User.register(fields.username,fields.password,fields.email,function(result){
					switch(result){
						case 0:
							res.writeHead(500).end();
						break;
						case -1:
						case -2:
						case -3:
							console.error('[HTTP] /v1/mail，操作 register 於已檢查的資料被確認出不合法！')
							res.writeHead(500).end();
						break;
						case -11:
							res.writeHead(200).end('username');
						break;
						case -12:
							res.writeHead(200).end('email');
						break;
						default:
							res.writeHead(200).end('OK');
					}
				});
			break;
			default:
				console.error('[HTTP] /v1/mail 未知的操作 %s',actionInfo.action);
				res.writeHead(500).end();
		}
	});
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

module.exports=router;