var Util=require('util');
var Base=require('./Base.js');
var Normal=require('./Normal.js');
var Channel=require('../Channel.js');
var Config=require('../Config.js');
var User=require('../User.js');

/* 驗證身份指令組 */
function Auth(user){
	this.authing=false;
	this.user=user;
	this.timeout=setTimeout(Auth.timeout,10000,user);
}
Util.inherits(Auth,Base);
Auth.prototype.umount=function(){
	if(this.timeout) clearTimeout(this.timeout);
	this.user=null; 
}
Auth.timeout=function(user){
	user.exit(4100);
}
Auth.prototype.action={
	'auth': function(data){
		if(!data.username || this.authing){
			return;
		}
		var _=this;
		User.auth(data.username,data.password,function(result){
			if(result===0){
				_.user.exit(4003);
				return;
			}else if(result===-3){
				_.user.exit(4101);
			}else if(result<0){
				_.user.exit(4102);
			}else if(User.findById(result.id)){
				_.user.exit(4103);
			}else{
				_.user.updateId(result.id);
				_.user.username=result.username;
				_.user.actionGroup=new Normal(_.user);
				_.user.send({
					'action': 'auth',
					'status': 'success',
					'userId': result.id
				});
				Channel.findById(Config.channelDefault).join(_.user,true);//進入預設頻道，無視頻道人數上限
				_.user.send({
					'action': 'channel_switch',
					'status': 'force',
					'channelId': Config.channelDefault
				});
				_.umount();
			}
		});
	}
}

module.exports=Auth;