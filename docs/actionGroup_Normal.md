# Normal 指令集
處理一般使用的所有指令。
## 用戶端主動發送指令列表
### channel_list
按以下格式返回現存的頻道清單。

* `action` (String) channel_list
* `list` (Array)
	* (Object) 頻道資訊
		* `channelId` (Number) 頻道ID
		* `name` (String) 頻道名稱

### channel_switch
頻道切換。
#### 參數
* `channelId` (Number) 目標頻道ID

#### 返回結果
見 伺服端主動發送指令列表 channel_switch

### channel_userList
返回指定頻道在線列表。
#### 參數
* `channelId` (Number,選擇性) 目標頻道ID，未指定則返回當前所在頻道的在線列表

#### 返回結果
##### 查詢成功
按以下格式返回在線列表。

* `action` (String) channel_userList
* `status` (String) success
* `channelId` (Number) 請求的頻道ID
* `list` (Array)
	* `userId` (Number) 使用者ID

##### 查詢失敗 - 頻道不存在
按以下格式返回。

* `action` (String) channel_userList
* `status` (String) not exists

### chat_normal
於所在頻道發言。
#### 參數
* `msg` (String) 訊息內容

#### 返回結果
##### 成功
見 伺服端主動發送指令列表 chat_normal

##### 失敗
無回應。

### chat_private
對指定使用者發送訊息。
#### 參數
* `toUserId` (Number) 目標使用者ID
* `msg` (String) 訊息內容

#### 返回結果
##### 成功
見 伺服端主動發送指令列表 chat_private

##### 失敗 - 目標不在線
發送方收到以下格式的訊息。

* `action` (String) chat_private
* `error` (String) offline or not exists
* `toUserId` (Number) 目標使用者ID

### chatlog_query
查詢聊天記錄，不包含快取中的記錄
#### 欄位
* `type` (String) 查詢類型
	* `public` 公開訊息，包含公告、公開聊天訊息
	* `private` 私人訊息，包含密頻、管理員密頻
* `channelId` (Number,選擇性) 查詢頻道，查詢類型為 `public` 時有效
* `userId` (Number,選擇性) 查詢使用者，查詢類型為 `private` 時有效
* `startTime` (Number,選擇性) 查詢在此之後發送的訊息，Unix Time (ms)
* `endTime` (Number,選擇性) 查詢在此之前發送的訊息，Unix Time (ms)
* `startMessageId` (Number,選擇性) 查詢在此編號之後的訊息
* `limit` (Number,選擇性) 查詢結果數量限制，預設 100，最大 500

#### 返回結果
返回以下指令

* `action` (String) chatlog_query
* `result` (Array) 查詢結果
	* (Object)
		* `messageId` (Number) 記錄編號
		* `time` (Number) 發言時間，Unix Time (ms)
		* `fromUserId` (Number) 發言者 userId
		* `toUserId` (Number or Null) 目標 userId，非密頻則為 Null
		* `channelId` (Number or Null) 發言頻道，密頻則為 Null
		* `type` (String) 發言類型
			* `normal` 一般發言
			* `private` 密頻
			* `global` 廣播、管理訊息
		* `message` (String) 發言內容

### user_getProfile
取得自己的使用者資料
#### 參數
* `userIds` (Array)
	* (Number) 欲查詢的 userId

#### 返回結果
##### 查詢成功
返回以下格式資料

* `action` (String) user_getProfile
* `status` (String) success
* `profile` (Object)
	* `userId` (Number) 使用者ID
	* `username` (String) 帳號
	* `email` (String) 信箱(僅查詢目標為自己時)
	* `regTime` (Number) 註冊時間的 Unix Time(ms)

##### 查詢失敗
返回以下格式資料

* `action` (String) user_getProfile
* `status` (String) fail
* `profile` (Object)
	* `userId` (Number) 使用者ID

### user_editProfile
以 Hmac驗證方法 進行密碼驗證，修改自己的使用者資料
#### 參數
* `answer` (Hex) 32 Bytes SHA256 Hash 答案
* `email` (String,選擇性) 設定新 E-amil
* `password` (Hex,選擇性) 設定新登入密碼，32 Bytes 經過 SHA256 Hash 的密碼

#### 返回結果
##### 成功
返回以下指令

* `action` (String) user_editProfile
* `status` (String) success

##### 失敗 - 目前密碼驗證失敗
返回以下指令

* `action` (String) user_editProfile
* `status` (String) auth fail

### user_listSession
列出使用者所有的 Session

#### 返回結果
返回以下指令

* `action` (String) user_listSession
* `sessions` (Array)
	* `session`	(Object)
		* `session`		(Hex)
		* `createTime`	(Number) 建立時間，Unix Time (ms)
		* `lastClient`	(String) 最後使用的用戶端
		* `lastLogin`	(Number) 最後登入時間，Unix Time (ms)
		* `online`		(Boolean) 當前是否在線

### user_logout
登出
#### 參數
無

#### 返回結果
以狀態碼 `1000` 斷線處理。

### user_removeSession
刪除 Session

#### 參數
* `session` (Hex)  20 Bytes 的刪除目標 session

#### 返回結果
##### 成功
返回以下指令

* `action` (String) user_removeSession
* `session` (Hex) 20 Bytes 的刪除目標 session
* `status` (String) removed

##### 失敗 - 為當前連線 Session
返回以下指令

* `action` (String) user_removeSession
* `session` (Hex) 20 Bytes 的刪除目標 session
* `status` (String) now session

## 伺服端主動發送指令列表
### channel_exit
有人離開了頻道
####參數
* `userId` (Number) 使用者ID

### channel_join
有人進入了頻道
####參數
* `userId` (Number) 使用者ID

### channel_list
更新頻道列表

### channel_switch
所在頻道變更，或執行變更指令失敗
#### 欄位
* `action` (String) channel_switch
* `status` (String)
	* `default` - 切換至預設頻道(所在頻道被刪除、剛連上伺服器時出現)
	* `force` - 被管理員強制搬移
	* `full` - 目標頻道人數已滿
	* `not exists` - 目標頻道不存在
	* `success` - 切換成功
* `channelId` (Number) 目標頻道ID

### chat_global
伺服器廣播訊息
#### 欄位
* `action` (String) chat_global
* `msg` (String) 訊息內容
* `time` (Number) 發送時間的 Unix Time (ms)

### chat_normal
使用者所在頻道有新的訊息
#### 欄位
* `action` (String) chat_normal
* `fromUserId` (Number) 發言者ID
* `msg` (String) 訊息內容
* `time` (Number) 發送時間的 Unix Time (ms)

### chat_notice
伺服器提示訊息
#### 欄位
* `action` (String) chat_global
* `msg` (String) 訊息內容
* `time` (Number) 發送時間的 Unix Time (ms)

### chat_private
有發送給使用者或由使用者發送的密頻訊息
#### 欄位
* `action` (String) chat_private
* `fromUserId` (Number) 發言者ID
* `toUserId` (Number) 目標使用者ID
* `msg` (String) 訊息內容
* `time` (Number) 發送時間的 Unix Time (ms)
