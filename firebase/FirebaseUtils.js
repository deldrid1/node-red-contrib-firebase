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
		if(queryname == "limitToFirst" || queryname == "limitToLast"){
			queryvalue = parseInt(queryvalue);
		}
    	ref = ref[queryname](queryvalue); 
	}       
	else if (queryvalType == "msg") { 
		var val = msg[queryvalue];
		if(queryname == "limitToFirst" || queryname == "limitToLast"){
			val = parseInt(val);
		} 
		ref = ref[queryname](val);
	}
	else if(queryvalType == "flow"){
		var val =  obj.context().flow.get(queryvalue);
		if(queryname == "limitToFirst" || queryname == "limitToLast"){
			val = parseInt(val);
		} 
		ref = ref[queryname](val);
	}
	else if(queryvalType == "global")
	{
		var val =  obj.context().global.get(queryvalue);
		if(queryname == "limitToFirst" || queryname == "limitToLast"){
			val = parseInt(val);
		} 
		ref = ref[queryname](val);
	}
	else if(queryvalType == "num"){
		
		if(queryname == "limitToFirst" || queryname == "limitToLast"){
			val = parseInt(queryvalue);
		}
		else{console.log("hopefully not here")
			var val = queryvalue.toString();
			}
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
