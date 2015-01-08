# 通訊協定說明
所有傳輸內容皆使用 JSON 處理後傳輸，由 `action` 欄位決定執行哪個指令。
不符合 JSON 格式或沒有 `action` 欄位的情況，伺服器將忽略傳輸內容或斷線處理。

# 指令集
## Auth 指令集
處理身份驗證，驗證成功則將連線轉送其他指令集，否則斷線處理。
如超過 10000 毫秒仍未完成驗證程序，以狀態碼 `4100` 斷線處理。
### auth
執行身份驗證。
#### 參數
* `username` (String) 登入帳號
* `password` (String) 登入密碼，建議先將原始密碼做一次 128 位元以上的 hash 後送出，最短32個字

#### 返回結果
##### 驗證成功
返回以下指令後，移動至預設頻道，轉送 Normal 指令集。
* `action` (String) auth
* `status` (String) success

##### 驗證成功 - 重複登入
以狀態碼 `4103` 斷線處理。

##### 驗證失敗 - 系統錯誤
以狀態碼 `4003` 斷線處理。

##### 驗證失敗 - 帳號停用中
以狀態碼 `4101` 斷線處理。

##### 驗證失敗 - 帳號密碼不對
以狀態碼 `4102` 斷線處理。

## Normal 指令集
處理一般使用的所有指令。
### channel_list
按以下格式返回現存的頻道清單。
* `action` (String) channel_list
* `list` (Array)
	* (Object) 頻道資訊
		* `channelId` (Number) 頻道ID
		* `Name` (String) 頻道名稱

### channel_switch
頻道切換。
#### 參數
* `channelId` (Number) 目標頻道ID

#### 返回結果
##### 切換成功
切換頻道後，返回以下指令。
* `action` (String) channel_switch
* `status` (String) success
* `channelId` (Number) 目標頻道ID

##### 切換失敗 - 人數已滿
返回以下指令。
* `action` (String) channel_switch
* `status` (String) full
* `channelId` (Number) 目標頻道ID

##### 切換失敗 - 頻道不存在
返回以下指令。
* `action` (String) channel_switch
* `status` (String) not exists
* `channelId` (Number) 目標頻道ID

### channel_userList
返回指定頻道在線列表。
#### 參數
* `channelId` (Number,選擇性) 目標頻道ID，未指定則返回當前所在頻道的在線列表

#### 返回結果
##### 查詢成功
按以下格式返回在線列表。
* `action` (String) channel_userList
* `status` (String) success
* `list` (Array)
	* (Object) 使用者
		* `id` (Number) 使用者ID
		* `username` (String) 使用者名稱

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
該頻道下所有使用者收到以下格式的訊息。
* `action` (String) chat_normal
* `fromUserId` (Number) 發言者ID
* `msg` (String) 訊息內容

##### 失敗
無回應。

### chat_private
對指定使用者發送訊息。
#### 參數
* `toUserId` (Number) 目標使用者ID
* `msg` (String) 訊息內容

#### 返回結果
##### 成功
接收方及發送方收到以下格式的訊息。
* `action` (String) chat_private
* `fromUserId` (Number) 發言者ID
* `toUserId` (Number) 目標使用者ID
* `msg` (String) 訊息內容

##### 失敗 - 目標不在線
發送方收到以下格式的訊息。
* `action` (String) chat_private_fail
* `status` (String) offline or not exists
* `toUserId` (Number) 目標使用者ID

### user_getProfile
取得自己的使用者資料
#### 參數
無

#### 返回結果
##### 查詢成功
返回以下格式資料
* `action` (String) user_getProfile
* `status` (String) success
* `profile` (Object)
	* `id` (Number) 使用者ID
	* `username` (String) 帳號
	* `regTime` (Number) 註冊時間的 Unix Time

##### 查詢失敗
返回以下格式資料
* `action` (String) user_getProfile
* `status` (String) fail

### user_editProfile
修改自己的使用者資料
#### 參數
* `password` (String) 登入密碼，建議先將原始密碼做一次 128 位元以上的 hash 後送出，最短32個字
* `email` (String,選擇性) 設定新 E-amil
* `newPassword` (String,選擇性) 設定新登入密碼，建議先將原始密碼做一次 128 位元以上的 hash 後送出，最短32個字

#### 返回結果
##### 成功
返回以下指令
* `action` (String) user_editProfile
* `status` (String) success

##### 失敗 - 目前密碼驗證失敗
返回以下指令
* `action` (String) user_editProfile
* `status` (String) auth fail

##### 失敗 - 其他原因
返回以下指令
* `action` (String) user_editProfile
* `status` (String) fail

### user_logout
登出
#### 參數
無

#### 返回結果
自動進行頻道退出，並以狀態碼 `1000` 斷線處理。