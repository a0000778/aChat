var Util=require('util');
var Base=require('./Base.js');
var Normal=require('./Normal.js');
var Channel=require('../Channel.js');
var Config=require('../Config.js');
var User=require('../User.js');

/* 驗證身份指令組 */
function Auth(user){
	this.user=user;
	this.timeout=setTimeout(Auth.timeout,10000,user);
}
Util.inherits(Auth,Base);
Auth.prototype.umount=function(){
	if(this.timeout) clearTimeout(this.timeout);
	this.user=null; 
}
Auth.timeout=function(user){
	user.exit(4000);
}
Auth.action={
	'auth': function(data){
		if(!data.username){
			return;
		}
		User.auth(data.username,data.password,function(result){
			if(result===0){
				this.user.exit(4003);
				return;
			}else if(result<0){
				this.user.exit(4102);
			}else if(!result.action){
				this.user.exit(4101);
			}else if(User.findById(result.id)){
				this.user.exit(4103);
			}else{
				this.user.id=result.id;
				this.user.username=result.username;
				this.user.actionGroup=new Normal(this.user);
				this.user.send({
					'action': 'auth',
					'status': 'success'
				});
				Channel.findById(Config.channelDefault).join(this.user,true);//進入預設頻道，無視頻道人數上限
				this.umount();
			}
		});
	}
}

module.exports=Auth;