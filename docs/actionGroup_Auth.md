# Auth 指令集
處理身份驗證，驗證成功則將連線轉送其他指令集，否則斷線處理。
如超過 10 秒仍未完成驗證程序，以狀態碼 `4100` 斷線處理。

## 用戶端主動發送指令列表
### client
發送當前用戶端資訊
####參數
* `client` (String) 150 字以內的用戶端資訊

#### 返回結果
無返回

### createSession
以 Hmac驗證方法 進行密碼驗證，建立 session
#### 參數
* `username` (String) 登入帳號
* `answer` (Hex) 32 Bytes SHA256 Hmac 答案

#### 返回結果
##### 建立成功
* `action` (String) createSession
* `userId` (Number) session 所屬 userId
* `session` (Hex) 20 Bytes 的 session

##### 驗證失敗 - 帳號停用中
以狀態碼 `4101` 斷線處理。

##### 驗證失敗
以狀態碼 `4102` 斷線處理。

##### 未產生 Hash 問題
無回應

### authBySession
以 session 驗證
#### 參數
* `userId` (Number) session 所屬 userId
* `session` (Hex) 20 Bytes 的 session

#### 返回結果
##### 驗證成功
返回以下指令後，移動至預設頻道並輸出離線留言，轉送 Normal 指令集。

* `action` (String) authBySession
* `status` (String) success
* `userId` (Number) 帳號ID
* `actionGroup` (String) 當前指令集名稱

##### 驗證失敗 - 帳號停用中
以狀態碼 `4101` 斷線處理。

##### 驗證失敗 - Session 不存在
以狀態碼 `4102` 斷線處理。
