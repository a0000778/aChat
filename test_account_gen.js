var Crypto=require('crypto');
var FS=require('fs');
var mysql=require('mysql');
var Config=require('./Config.js');
const saltLength=8;//salt 長度
const saltChar='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`-=[];’,./~!@#$%^&*()_+{}|:”<>?\\';//salt 字元

var max=500;
var count=0;
var prevCount=0;
var waiting=2;
var sp='';
var sqlFile=FS.createWriteStream('./test_account.sql');
var jsFile=FS.createWriteStream('./test_account.js');
setInterval(function(){
	console.log('當前進度: %d / %d (%d 個/s)',count,max,count-prevCount);
	prevCount=count;
},1000);

sqlFile
	.on('open',function(){
		sqlFile.write('INSERT INTO `user` (`username`,`password`,`salt`,`email`,`active`,`regTime`) VALUES \n', 'utf8');
		waiting--;
		startGen();
	})
	.on('close',endGen)
;
jsFile
	.on('open',function(){
		jsFile.write('module.exports=[\n','utf8');
		waiting--;
		startGen();
	})
	.on('close',endGen)
;

function startGen(){
	if(waiting) return;
	setImmediate(gen);
}
function gen(){
	if(count>=max){
		sqlFile.end(';','utf8');
		jsFile.end('];','utf8');
		waiting=2;
		return;
	}
	var username='test_'+fillZero(count,4);
	var password=genPassword();
	var salt=genSalt();
	var passwordStore=passwordHash(password,salt);
	sqlFile.write(sp+mysql.format(
		'(?,?,?,?,?,?)',
		[username,passwordStore,salt,'a0000778@gmail.com',true,Math.floor(new Date().getTime()/1000)]
	)+'\n','utf8');
	jsFile.write(sp+JSON.stringify({'username':username,'password':password})+'\n','utf8');
	sp=',';
	count++;
	setImmediate(gen);
}
function endGen(){
	waiting--;
	if(waiting) return;
	console.log('完成！');
	process.exit();
}
function fillZero(num,len){
	num=num.toString();
	while(num.length<len)
		num='0'+num;
	return num;
}
function genPassword(){
	var hash='';
	while(hash.length<64)
		hash+=fillZero(Math.floor(Math.random()*Math.pow(16,8)).toString(16),8);
	return hash;
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