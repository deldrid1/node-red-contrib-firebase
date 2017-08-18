this.getType = function(Type,Typevalue,msg,obj){
	var value;
	if(Type == "msg"){
	  value = msg[Typevalue];
	}
	else if(Type=="flow"){          
	  value =  obj.context().flow.get(Typevalue);
	}
	else if(Type =="global"){
	  value =  obj.context().global.get(Typevalue);
	}
	else if(Type =="str"){
	  value =  Typevalue
	}
	else if(Type == "date"){
		value = Date.now();
	}
	else{
	  value = Type;
	}
	return value;
}

this.getRef = function(ref,queryvalType,queryname,queryvalue,msg,obj){
	if(queryvalType == "str"){
    	ref = ref[queryname](queryvalue); 
	}       
	else if (queryvalType == "msg") { 
		var val = msg[queryvalue]; 
		ref = ref[queryname](val);
	}
	else if(queryvalType == "flow"){
		var val =  obj.context().flow.get(queryvalue);
		ref = ref[queryname](val);
	}
	else if(queryvalType == "global")
	{
		var val =  obj.context().global.get(queryvalue);
		ref = ref[queryname](val);
	}
	else if(queryvalType == "num"){
		var val = queryvalue.toString();
		ref = ref[queryname](val);
	}
	else if(queryvalType == "json"){ 
		ref = queryvalType;
	}
	else if(queryvalType == "jsonata"){ 
		ref = queryvalType;
	}
	return ref;
}
