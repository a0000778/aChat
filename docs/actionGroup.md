ActionGroup 收發所有以 WebSocket 連上的用戶端的指令，
指令解析交由各指令集的 `_exec(data)` 方法進行，
預設的指令集為 `Auth`。

# 指令集
## Base
負責初步解析指令，並提供其他指令會使用到的函式庫

* `_exec(data)` 負責解析、執行對應函式
* `_execObject(data,...)` 提供指令集內部自行執行指令
* `_umount` 卸載指令集，切換指令集前必須執行
### 用戶端主動發送指令列表
#### createQuestion
須 Hmac驗證方法 的操作的前置指令

##### 返回結果
* `action` (String) question
* `question` (Hex) 8 Bytes 的 Hmac 問題

## Admin
管理用指令集，繼承 `Base`, `Normal` 指令集，請參考 `actionGroup_Admin.md`。

## Auth
特殊指令集，處理身份驗證，僅針對 `Link` 做操作，繼承 `Base` 指令集，請參考 `actionGroup_Auth.md`。

## Normal
一般指令集，繼承 `Base` 指令集，請參考 `actionGroup_Normal.md`。