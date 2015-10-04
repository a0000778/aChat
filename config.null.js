var readFileSync=require('fs').readFileSync;

function readFile(filename){
	return readFileSync(filename,{'encoding': 'utf8'});
}

module.exports={
	'debug': true,					//除錯模式
	'port': 9700,					//伺服器監聽 port
	'ssl': false,					//SSL連線，設定項參考 http://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener
	
	'sessionMax': 1000,				//全服最大連線數
	
	'channelDefault': 1,			//預設頻道ID
	'channelUserMax': 200,			//單一頻道人數上限
	
	'chatLogCacheCount': 500,		//聊天記錄寫入快取筆數上限
	
	'mailTimeout': 3600*1000,		//發信確認類有效時間(秒)
	'mailSender': 'me@chat',		//確認信發信者E-mail
	'mailTemplate': {
		'register': {
			/*
			註冊驗證信模板
			{username}	表示使用者帳號
			{code}		表示驗證碼
			*/
			'subject': '[aChat 聊天室] 信箱驗證',
			'contentText': readFile('./template/register.txt'),
			'contentHTML': null
		},
		'forgotPassword': {
			/*
			密碼重設確認信模板
			{username}	表示使用者帳號
			{code}		表示重設碼
			*/
			'subject': '[aChat 聊天室] 密碼重置確認',
			'contentText': readFile('./template/forgotPassword.txt'),
			'contentHTML': null
		},
		'resetPassword': {
			/*
			密碼重設信模板
			{username}	表示使用者帳號
			{password}	表示新密碼
			*/
			'subject': '[aChat 聊天室] 新密碼',
			'contentText': readFile('./template/resetPassword.txt'),
			'contentHTML': null
		},
		'updateEmail': {
			/*
			信箱驗證信模板
			{username}	表示使用者帳號
			{code}		表示驗證碼
			*/
			'subject': '[aChat 聊天室] 信箱更新驗證',
			'contentText': readFile('./template/updateEmail.txt'),
			'contentHTML': null
		}
	},
	
	'mysql': {					//資料庫連線設定，詳細參考套件 mysql
		'host': 'localhost',
		'port': 3306,
		'user': 'achat',
		'password': '',
		'database': 'achat',
		'connectionLimit': 10
	},
	
	'mailer': {						//發信設定，詳細參考套件 nodemailer
		'host': 'localhost',
		'port': 25,
		'secure': false,
		'auth': {
			'user': '',
			'pass': ''
		}
	}
}