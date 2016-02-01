'use strict';
var config=require('./config.js');
var crypto=require('crypto');
var domainCreate=require('domain').create;
var formidable=require('formidable');
var nodemailer=require('nodemailer');
var router=require('light-router');
var util=require('util');
var user=require('./user.js');

var codeList=new Map();
var keepUsername=new Set();
var codeListClear=setInterval(clearCode,60000);
var mailer=nodemailer.createTransport(config.mailer);

router.options('/v1/forgotPassword',allowPost);
router.post('/v1/forgotPassword',function(req,res){
	new formidable({
		'maxFieldsSize': 512,
		'maxFields': 1,
	}).parse(req,function(error,fields,files){
		if(error || !fields.hasOwnProperty('email') || !user.fieldCheck.email(fields.email)){
			res.writeHead(400);
			res.end();
			return;
		}
		user.findUser('email',fields.email,function(result){
			res.end();
			if(!result) return;
			let code=genCode();
			let resetInfo={
				'action': 'resetPassword',
				'timeout': Date.now()+config.mailTimeout,
				'userId': result.userId,
				'username': result.username,
				'email': result.email
			}
			let mailTemplate=config.mailTemplate.forgotPassword;
			let mailArgs={
				'username': result.username,
				'code': code
			};
			mailer.sendMail({
				'from': config.mailSender,
				'to': result.email,
				'subject': renderTemplate(mailTemplate.subject,mailArgs),
				'text': renderTemplate(mailTemplate.contentText,mailArgs),
				'html': renderTemplate(mailTemplate.contentHTML,mailArgs)
			});
			codeList.set(code,resetInfo);
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
			res.end('not exists');
			return;
		}
		codeList.delete(fields.code);
		user.resetPassword(actionInfo.userId,function(password){
			res.end('OK');
			let mailTemplate=config.mailTemplate.resetPassword;
			let mailArgs={
				'username': actionInfo.username,
				'password': password
			};
			mailer.sendMail({
				'from': config.mailSender,
				'to': actionInfo.email,
				'subject': renderTemplate(mailTemplate.subject,mailArgs),
				'text': renderTemplate(mailTemplate.contentText,mailArgs),
				'html': renderTemplate(mailTemplate.contentHTML,mailArgs)
			});
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
			fields.hasOwnProperty('username') && user.fieldCheck.username(fields.username) &&
			fields.hasOwnProperty('email') && user.fieldCheck.email(fields.email) &&
			fields.hasOwnProperty('password') && (fields.password=toBuffer(fields.password)) && user.fieldCheck.password(fields.password)
		)){
			res.writeHead(400);
			res.end();
			return;
		}
		if(keepUsername.has(fields.username)){
			res.end('username');
			return;
		}
		user.checkExists(fields.username,fields.email,function(result){
			if(result=='username' || result=='username,email'){
				res.end('username');
			}else if(result=='email'){
				res.end('email');
			}else{
				let code=genCode();
				let regInfo={
					'action': 'register',
					'timeout': Date.now()+config.mailTimeout,
					'username': fields.username,
					'email': fields.email,
					'password': fields.password
				};
				let mailTemplate=config.mailTemplate.register;
				let mailArgs={
					'username': fields.username,
					'code': code
				};
				mailer.sendMail({
					'from': config.mailSender,
					'to': fields.email,
					'subject': renderTemplate(mailTemplate.subject,mailArgs),
					'text': renderTemplate(mailTemplate.contentText,mailArgs),
					'html': renderTemplate(mailTemplate.contentHTML,mailArgs)
				});
				codeList.set(code,regInfo);
				keepUsername.add(regInfo.username);
				res.end('OK');
			}
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
			res.end('not exists');
			return;
		}
		let actionInfo=codeList.get(fields.code);
		codeList.delete(fields.code);
		if(actionInfo.action=='register'){
			keepUsername.delete(actionInfo.username);
			user.createUser(actionInfo.username,actionInfo.password,actionInfo.email,function(result){
				if(result=='username' || result=='username,email'){
					res.end('username');
				}else if(result=='email'){
					res.end('email');
				}else{
					res.end('OK');
				}
			});
		}else if(actionInfo.action=='updateEmail'){
			user.updateProfile(actionInfo.userId,{'email': actionInfo.email},function(){
				res.end('OK');
			});
		}
	});
});
if(config.debug) router.get('/v1/status',function(req,res){
	let db=require('./db.js');
	let channel=require('./channel.js');
	let outputContent='';
	
	outputContent+=util.format('連線數: %d / %d\n',user.sessionCount,config.sessionMax);
	outputContent+=util.format('使用者: %d\n',user.userCount);
	outputContent+=util.format('記憶體: %d KB\n',Math.ceil(process.memoryUsage().rss/1024));
	outputContent+=util.format('記錄寫入快取: %d\n',db.chatLogCacheCount());
	
	outputContent+=util.format('\n頻道列表:\n');
	for(let ch of channel.list())
		outputContent+=util.format(
			'%d: %s, lock=%j, userCount=%d / %d\n',
			ch.channelId,
			ch.name,
			ch.lock,
			ch.onlineList.size,
			ch.onlineMax
		);
	
	outputContent+=util.format('\n連線列表:\n');
	for(let sess of user.listSession()){
		let u=sess.user
		if(u){
			outputContent+=util.format(
				'%s: userId=%d, session=%s, client=%s, username=%s, actionGroup=%s, channel=%s(%d)\n',
				sess.link.remoteAddress,
				u.userId,
				sess.session.toString('hex'),
				sess.client || '(未知)',
				u.username,
				u.actionGroup.constructor.name,
				u.channel && u.channel.name,
				u.channel && u.channel.channelId
			);
		}else
			outputContent+=util.format(
				'%s: 未驗證\n',
				sess.link.remoteAddress
			);
	}
	
	outputContent+=util.format('\n驗證代碼列表: (共計 %d 筆)\n',codeList.size);
	for(let code of codeList){
		outputContent+=util.format(
			'%s: action=%s, username=%s, timeout=%s\n',
			code[0],
			code[1].action,
			code[1].username,
			new Date(code[1].timeout).toLocaleString()
		);
	}
	
	res.setHeader('Content-Type','text/plain; charset=utf-8');
	res.write(outputContent);
	res.end();
});

function clearCode(){
	let now=Date.now();
	for(let codeInfo of codeList){
		if(codeInfo[1].timeout<now){
			codeList.delete(codeInfo[0]);
			if(codeInfo[1].action=='register')
				keepUsername.delete(codeInfo[1].username);
		}
	}
}
function genCode(){
	return crypto.randomBytes(20).toString('hex');
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
function toBuffer(hex){
	return typeof(hex)==='string' && /^[0-9a-f]+$/i.test(hex) && new Buffer(hex,'hex');
}

module.exports={
	'createUpdateEmail': function(userId,username,email){
		let code=genCode();
		let updateInfo={
			'action': 'updateEmail',
			'timeout': Date.now()+config.mailTimeout,
			'userId': userId,
			'username': username,
			'email': email
		}
		let mailTemplate=config.mailTemplate.updateEmail;
		let mailArgs={
			'username': username,
			'code': code
		};
		mailer.sendMail({
			'from': config.mailSender,
			'to': email,
			'subject': renderTemplate(mailTemplate.subject,mailArgs),
			'text': renderTemplate(mailTemplate.contentText,mailArgs),
			'html': renderTemplate(mailTemplate.contentHTML,mailArgs)
		});
		codeList.set(code,updateInfo);
	},
	'request': function(req,res){
		let domain=domainCreate();
		domain.add(req);
		domain.add(res);
		domain.on('error',function(error){
			console.error(error.stack);
			res.writeHead(500);
			res.end();
		});
		domain.enter();
	
		if(req.headers['origin']) res.setHeader('Access-Control-Allow-Origin',req.headers['origin']);
		router(req,res);
	
		domain.exit();
	}
}