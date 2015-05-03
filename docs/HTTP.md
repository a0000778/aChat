# POST /v1/mail - 驗證信箱
驗證E-mail
## 資料欄位
* `code` 驗證代碼

## 返回資訊
* `OK` 驗證成功
* `not exists` 代碼不存在

# POST /v1/forgotPassword - 忘記密碼
以 E-mail 判斷目標用戶，並發送密碼重置信。
## 資料欄位
* `email`

## 返回資訊
無

# POST /v1/register - 註冊
註冊帳號。
## 資料欄位
* `username` 登入帳號，亦為顯示名稱
* `email`
* `password`

## 返回資訊
* `OK` 成功
* `username` 名稱重複
* `email` E-mail重複