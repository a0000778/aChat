'use strict';
var Util=require('util');
var Base=require('./Base.js');
var Channel=require('../Channel.js');
var Config=require('../Config.js');
var User=require('../User.js');
var ActionGroup;
setImmediate(function(){//迴避互相依賴
	ActionGroup=require('../ActionGroup.js');
});

/* 驗證身份指令組 */
function Auth(user){
	Base.call(this,user);
	this._authing=false;
	this._timeout=setTimeout(Auth.timeout,10000,user);
}
Util.inherits(Auth,Base);
Auth.prototype._umount=function(){
	if(this._timeout) clearTimeout(this._timeout);
	Base.prototype._umount.call(this);
}
Auth.timeout=function(user){
	user.exit(4100);
}
Auth.prototype.auth=function(data){
	if(!data.username || !data.password || this._authing) return;
	var _=this;
	this._authing=true;
	User.auth(data.username,data.password,function(result){
		if(result===0){
			_._user.exit(4003);
			return;
		}else if(result===-3){
			_._user.exit(4101);
		}else if(result<0){
			_._user.exit(4102);
		}else if(User.findById(result.userId)){
			_._user.exit(4103);
		}else{
			if(_._user.link.protocol=='adminv1' && result.actionGroup!='Admin'){
				_._user.exit(4102);
				return;
			}
			if(!ActionGroup.hasOwnProperty(result.actionGroup)){
				_._user.exit(4003);
				return;
			}
			_._user.updateId(result.userId);
			_._user.username=result.username;
			_._user.actionGroup=new ActionGroup[result.actionGroup](_._user);
			_._user.send({
				'action': 'auth',
				'status': 'success',
				'userId': result.userId
			});
			Channel.findById(Config.channelDefault).join(_._user,true);//進入預設頻道，無視頻道人數上限
			_._user.send({
				'action': 'channel_switch',
				'status': 'default',
				'channelId': Config.channelDefault
			});
			_._umount();
		}
		_._authing=false;
	});
}

module.exports=Auth;