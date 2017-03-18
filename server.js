var express = require("express");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var assert = require("assert");
//may not need this
//var ObjectId = mongodb.ObjectId;

var LIBRARY_COLLECTION = "smaugs_library";

var app = express();
var path = require("path");

/** bodyParser.urlencoded(options)
 * Parses the text as URL encoded data (which is how browsers tend to send form data from regular forms set to POST)
 * and exposes the resulting object (containing the keys and values) on req.body
 */
app.use(bodyParser.urlencoded({extended: true}));
/**bodyParser.json(options)
 * Parses the text as JSON and exposes the resulting object on req.body.
 */
app.use(bodyParser.json());

//create db variable globally for access by other routes
var db;

//TODO: change this to production url for mongo
var local_mongo_URL = 'mongodb://localhost:27017/myproject';
var mongo_url = process.env.MONGODB_URI;//heroku hosted mongo instance

//url was => process.env.MONGODB_URI
mongodb.MongoClient.connect(mongo_url, function(err, database) {
	//try connecting to server with the db with the connect()
	if(err){
		console.log(err);
		process.exit(1);
	}

	//update the database variable for callback reuse
	db = database;
	console.log("database connection ready!!");

	//Initialize the app
	var server = app.listen(process.env.PORT || 8080, function(){
		var port = server.address().port;
		console.log("App now running on port: ", port);
	});

	//insert documents
	//insertDocuments(db, function(){
	//	db.close();
	//});
});

/*
*
* MONGODB FUNCTIONS
*
*/

//insert document
var insertDocuments = function(db, callback){
	//get the documents collection
	var collection = db.collection(LIBRARY_COLLECTION);
	//insert some documents
	collection.insertMany([
		{a: 1}, {a: 2}, {a: 3}
	], function(err, result){
		assert.equal(err, null);
		assert.equal(3, result.result.n);
		assert.equal(3, result.ops.length);
		console.log("Inserted 3 documents into the collection");
		callback(result);
	});
}

//Generic error handler used by all endpoints
function handleError(res, reason, message, code){
	console.log("ERROR: " + reason);
	res.status(code || 500).json({"error":message});
}

//set object loaned out value to true and update db accordingly
function loanOut(item){
	//update value in db
	db.collection(LIBRARY_COLLECTION).update(
		{_id: item._id},
		{
			$set: {
				loaned_out: true,
				in_library: false
			}
		}
	)
}

app.set('views', __dirname + '/src');
app.set('view engine', 'ejs');

//get all items in the library
app.get("/api/items", function(req, res){
	db.collection(LIBRARY_COLLECTION).find({}).toArray(function(err, docs){
		if(err){
			handleError(res, err.message, "Failed to get items in the library");
		}else{
			res.status(200).json(docs);
		}
	});
});

//get items by title
app.post("/api/retrieveitem", function(req, res){
	//res.send('You sent the name "' + req.body.title + '".');
	
	db.collection(LIBRARY_COLLECTION).find({"title": req.body.title}).toArray(function(err, docs){
		if(err){
			handleError(res, err.message, "Failed to get items in the library");
		}else{
			if(docs.length == 0){
				//render item loaned out or doesn't exist page
				res.render('item_not_found');
			}else{
				res.status(200).json(docs);
			}	
		}
	});
});

//get items by title
app.post("/api/loan-item", function(req, res){
	//res.send('You sent the name "' + req.body.title + '".');
	
	db.collection(LIBRARY_COLLECTION).find({
		$and: [
			{"title": req.body.title},
			{"in_library": true}
		]
	}).toArray(function(err, docs){
		
		if(err){
			handleError(res, err.message, "Failed to get items in the library");
		}else{
			if(docs.length == 0){
				//render item loaned out or doesn't exist page
				res.render('item_not_found');
			}else{
				//set item key to loaned out
				for(var i = 0; i < docs.length; i++)
					loanOut(docs[i]);

				//show page confirming action
				res.render('finalise_loan');
			}
			//res.status(200).json(docs);
		}
	});
	
});

//get homepage
app.get("/", function(req, res){
	res.sendFile(path.join(__dirname + '/src/LibrarySystem.html'));
})

//get homepage
app.get("/LibrarySystem", function(req, res){
	res.sendFile(path.join(__dirname + '/src/LibrarySystem.html'));
})

//loan item route
app.get("/loanitem", function(req, res){
	res.sendFile(path.join(__dirname + '/src/loanitem.html'));
})

//display add item page
app.get("/additem", function(req, res){
	res.sendFile(path.join(__dirname + '/src/additem.html'));
})

//add new item to db
app.post("/api/additem", function(req, res){
	var newItem = req.body;

	//set in_library key to true before adding item
	newItem.in_library = true; 
	//set loaned out value to false as brand new items are not yet loaned out
	newItem.loaned_out = false;

	//res.send('You sent the name "' + req.body.title + '".');

	//TODO: add error handler for incorrect input if necessary
	db.collection(LIBRARY_COLLECTION).insertOne(newItem, function(err, doc){
		if(err){
			handleError(res, err.message, "Failed to add new item.");
		}else{
			res.status(201).json(doc.ops[0]);
		}
	});
});

//retrieve item location route
app.get("/retrieveitem", function(req, res){
	res.sendFile(path.join(__dirname + '/src/retrieveitem.html'));
})

//serving static files
app.use(express.static('public'));