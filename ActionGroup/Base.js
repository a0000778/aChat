function Base(){}
Base.prototype.exec=function(data){
	if(data.type!=='utf8') return;
	try{
		data=JSON.parse(data.utf8Data);
	}catch(e){ return; }
	if(typeof(data.action)==='string' && this.action.hasOwnProperty(data.action))
		this.action[data.action].apply(this,arguments);
}

module.exports=Base;