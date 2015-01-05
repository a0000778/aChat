var Util=require('util');
var Base=require('./Base.js');

/* 管理指令組 */
function Admin(user){
	this.user=user;
	
}
Util.inherits(Admin,Base);
Admin.action={
	
};

module.exports=Admin;