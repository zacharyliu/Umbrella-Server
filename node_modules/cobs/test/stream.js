var fs = require('fs');	
var cobs = require('..');
var splitStream = require('split');
var joinStream = require('join-stream');
var BlockStream = require('block-stream');

var encoder = fs.createReadStream(__dirname + '/stream.js')
	.pipe(splitStream(/(?=\n)/))
	.pipe(cobs.encodeStream()) // zero-packet framing

// here is our transmission format
// encoder.pipe(fs.createWriteStream(__dirname + '/../compare.txt'));

var buf = '';
var decoder = encoder
	.pipe(new BlockStream(21)) // arbitrary chunking of packet data...
	.pipe(cobs.decodeStream()) // split into correct packets again
	.pipe(joinStream(''))
	.on('data', function (data) {
		buf += String(data);
	}).on('end', function () {
		// fs.writeFileSync(__dirname + '/../compare.txt', buf);
		console.log('Success:', fs.readFileSync(__dirname + '/stream.js', 'utf-8') == buf);
	})