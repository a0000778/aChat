# Admin 指令集
管理用指令集，繼承 Normal 指令集。
## 用戶端主動發送指令列表
### channel_create
新增頻道
#### 參數
* `name` (Number) 新頻道名稱

#### 返回結果
* `action` (String) channel_create
* `status` (String)
	* success - 新增成功
	* fail - 新增失敗

###channel_edit
修改頻道選項
#### 參數
* `channelId` (Number) 目標頻道ID
* `name` (String,選擇性) 新頻道名稱

#### 返回結果
* `action` (String) channel_edit
* `status` (String)
	* success - 修改成功
	* fail - 修改失敗
	* not exists - 修改目標不存在

※沒有任何修改項目時將不傳回任何結果

###channel_delete
刪除頻道
#### 參數
* `channelId` (Number) 目標頻道ID

#### 返回結果
* `action` (String) channel_delete
* `status` (String)
	* success - 刪除成功
	* fail - 刪除失敗
	* not exists - 刪除目標不存在
	* default channel - 刪除目標為預設頻道
	* default channel not exists - 預設頻道不存在，無法進行頻道刪除動作

###user_kick
踢使用者下線
#### 參數
* `userId` (Number) 目標使用者ID

#### 返回結果
* `action` (String) user_kick
* `status` (String)
	* success - 成功
	* not exists - 目標不在線

###user_ban
停用使用者帳號，在線則順便踢下線
#### 參數
* `userId` (Number) 目標使用者ID

#### 返回結果
* `action` (String) user_ban
* `status` (String)
	* success - 成功
	* fail - 失敗
	* not exists - 目標不存在

###user_unban
啟用使用者帳號
#### 參數
* `userId` (Number) 目標使用者ID

#### 返回結果
* `action` (String) user_unban
* `status` (String)
	* success - 成功
	* fail - 失敗
	* not exists - 目標不存在

###chat_global
以廣播頻道發言，可全伺服器、特定頻道、特定使用者
#### 參數
* `channelId` (Number,選擇性) 目標頻道ID
* `userId` (Number,選擇性) 目標使用者ID
* `msg` (String) 訊息內容

※`channelId`, `userId` 只能同時選擇其一，同時存在的情況下將優先選擇 `userId`，都不存在則向全伺服器廣播
#### 返回結果
* `action` (String) chat_global
* `status` (String)
	* success - 成功
	* fail - 失敗，目標不存在、不在線