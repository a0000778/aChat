ActionGroup 收發所有以 WebSocket 連上的用戶端的指令，
指令解析交由各指令集的 `exec(data)` 方法進行，
預設的指令集為 `Auth`。

# 指令集
## Base
指令資訊從 JSON 格式解析為 Object，以 `action` 欄位決定執行的指令，
不符合 JSON 格式或沒有 `action` 欄位的情況，將忽略指令。

* `exec(data)` 負責解析、執行對應函式
* `_exec(data,...)` 提供指令集內部自行執行指令
* `umount` 卸載指令集，切換指令集前必須執行

## Admin
管理用指令集，繼承 `Base`, `Normal` 指令集，請參考 `ActionGroup_Admin.md`。

## Auth
身份驗證指令集，繼承 `Base` 指令集，請參考 `ActionGroup_Normal.md`。

## Normal
一般指令集，繼承 `Base` 指令集，請參考 `ActionGroup_Normal.md`。