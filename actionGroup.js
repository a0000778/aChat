'use strict';

var actionGroup=module.exports={};

process.nextTick(function(){
	actionGroup.Admin=require('./actionGroup/Admin.js');
	actionGroup.Auth=require('./actionGroup/Auth.js');
	actionGroup.Normal=require('./actionGroup/Normal.js');
});