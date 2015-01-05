function Base(){}
Base.prototype.exec=function(data){
	if(data.type!=='utf8') return;
	try{
		data=JSON.parse(data.utf8Data);
	}catch(e){ return; }
	if(typeof(data.action)==='string' && this.constructor.action.hasOwnProperty(data.action))
		this.constructor.action[data.action].call(this,data);
}

module.exports=Base;