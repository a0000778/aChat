module.exports={
	'port': 8080,					//伺服器監聽 port
	
	'userMax': 1000,				//全服最大在線人數
	'userPasswordHash': 'sha256',	//密碼 hash 方法，更改後必須連同資料庫欄位長度一同更改
	
	'channelDefault': 1,			//預設頻道ID
	'channelUserMax': 200,			//單一頻道人數上限
	
	'chatLogCacheCount': 500,		//每多少筆記錄寫入一次
	'chatLogCacheTTL': 600*1000,	//無觸發 chatLogCacheCount 的情況下，多久寫入一次記錄(毫秒)
	
	'DBConnect': {					//資料庫連線設定，詳細參考套件 mysql
		'host': 'server.acgciation.com',
		'port': 3306,
		'user': 'mgmggt_testchat',
		'password': '*Rr_sb16&]=]',
		'database': 'mgmggt_testchat',
		'connectionLimit': 10
	}
}