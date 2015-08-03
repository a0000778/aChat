module.exports={
	'debug': true,					//除錯訊息輸出
	'port': 9700,					//伺服器監聽 port
	'ssl': false,					//SSL連線，設定項參考 http://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener
	
	'userMax': 1000,				//全服最大在線人數
	
	'channelDefault': 1,			//預設頻道ID
	'channelUserMax': 200,			//單一頻道人數上限
	
	'chatLogCacheCount': 500,		//每多少筆記錄寫入一次
	'chatLogCacheTTL': 600*1000,	//無觸發 chatLogCacheCount 的情況下，多久寫入一次記錄(毫秒)
	
	'mailTimeout': 43200,			//發信確認類有效時間(秒)
	'mailSender': 'me@chat',		//確認信發信者E-mail
	'mailTemplate': {
		'checkMail': {
			/*
			信箱驗證信模板
			{username}	表示使用者帳號
			{code}		表示驗證碼
			*/
			'subject': '[aChat 聊天室] 信箱驗證',
			'contentText': '如果你沒有申請聊天室帳號或更改信箱，請忽略這封信件。\
			\
			驗證碼：{code}',
			'contentHTML': null
		},
		'forgotPassword': {
			/*
			密碼重設確認信模板
			{username}	表示使用者帳號
			{code}		表示重設碼
			*/
			'subject': '[aChat 聊天室] 密碼重置確認',
			'contentText': '如果你沒有進行密碼重設操作，請忽略這封信件。\
			\
			重設碼：{code}',
			'contentHTML': null
		},
		'resetPassword': {
			/*
			密碼重設信模板
			{username}	表示使用者帳號
			{password}	表示新密碼
			*/
			'subject': '[aChat 聊天室] 新密碼',
			'contentText': '新的密碼為 {password}，請盡快修改密碼。',
			'contentHTML': null
		}
	},
	
	'DBConnect': {					//資料庫連線設定，詳細參考套件 mysql
		'host': '10.211.55.8',
		'port': 3306,
		'user': 'achat',
		'password': '*Rr_sb16&]=]',
		'database': 'achat',
		'connectionLimit': 10
	},
	
	'mailer': {						//發信設定，詳細參考套件 nodemailer
		'host': 'localhost',
		'port': 25,
		'auth': {
			'user': '',
			'pass': ''
		}
	}
}