var crypto=require('crypto');
var fs=require('fs');
var mysql=require('mysql');

var max=1000;//產生數
var count=0;
var prevCount=0;
var waiting=2;
var sp='';
var sqlFile=fs.createWriteStream('./test_account.sql');
var jsFile=fs.createWriteStream('./test_account.js');
setInterval(function(){
	console.log('當前進度: %d / %d (%d 個/s)',count,max,count-prevCount);
	prevCount=count;
},1000);

sqlFile
	.on('open',function(){
		sqlFile.write('INSERT INTO `user` (`username`,`password`,`email`,`active`,`regTime`) VALUES \n', 'utf8');
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
	var password=passwordHash(genPassword());
	sqlFile.write(sp+mysql.format(
		'(?,?,?,?,?)',
		[username,password,username+'@localhost.local',true,new Date()]
	)+'\n','utf8');
	jsFile.write(sp+JSON.stringify({'username':username,'password':password.toString('hex')})+'\n','utf8');
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
	return crypto.randomBytes(4).toString('hex');
}
function passwordHash(password){
	return crypto.createHash('sha256').update(
		crypto.createHash('md5').update(password).digest()
	).update(password).digest();
}