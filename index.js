var DEBUG = false;

// var PORT = "/dev/cu.usbserial-A5025XYY";
var PORT = "/dev/cu.HC-06-DevB";

if (!DEBUG) {
  var SerialPort = require("serialport").SerialPort
  var serialPort = new SerialPort(PORT, {
    baudrate: 9600
  });
  var cobs = require("cobs");
}

var chroma = require("chroma-js");
var Color = require("color");

var LED_COUNT = 20;
var LED_COUNT_NUM_ROWS = 5;
var LED_COUNT_NUM_COLS = 4;
var LED_MAP = [
  [0, 1, 2, 3, 4],
  [9, 8, 7, 6, 5],
  [10, 11, 12, 13, 14],
  [19, 18, 17, 16, 15]
];

function ColorArray() {
  this.colors = [];
  for (var i = 0; i < LED_COUNT; i++) {
    this.colors.push([0x00, 0x00, 0x00]);
  }
};

ColorArray.prototype.setAt = function (col, row, color) {
  var index = LED_MAP[col][row];
  this.colors[index] = color;
  return this;
}

ColorArray.prototype.setCol = function (col, color) {
  for (var i = 0; i < LED_COUNT_NUM_ROWS; i++) {
    var index = LED_MAP[col][i];
    this.colors[index] = color;
  }
  return this;
}

ColorArray.prototype.setRow = function (row, color) {
  for (var i = 0; i < LED_COUNT_NUM_COLS; i++) {
    var index = LED_MAP[i][row];
    this.colors[index] = color;
  }
  return this;
}

ColorArray.prototype.setAll = function (color) {
  for (var i = 0; i < LED_COUNT_NUM_COLS; i++) {
    this.setCol(i, color);
  }
  return this;
}

ColorArray.prototype.toFlatArray = function () {
  var flatArray = [];
  for (var i = 0; i < LED_COUNT; i++) {
    flatArray = flatArray.concat(this.colors[i]);
  }
  return flatArray;
}

ColorArray.prototype.toData = function (duration) {
  // little-endian order
  var intArray = [intToHex(duration & 0x000000ff),
    intToHex((duration & 0x0000ff00) >> 8),
    intToHex((duration & 0x00ff0000) >> 16),
    intToHex((duration & 0xff000000) >> 24)];
  var dataArray = intArray.concat(this.toFlatArray());
  console.log("[" + dataArray.join(",") + "]");
  return cobs.encode(new Buffer(dataArray));
}

ColorArray.prototype.toString = function () {
  var allStrings = [];
  var colors = this.toFlatArray();
  for (var i = 0; i < colors.length / 3; i++) {
    var string = "#";
    for (var j = 0; j < 3; j++) {
      var addString = colors[i * 3 + j].toString(16);
      if (addString.length < 2) {
        addString = "0" + addString;
      }
      string += addString;
    }
    allStrings.push(string);
  }
  return allStrings.join(" ");
}

function intToHex(num) {
  return parseInt(num.toString(16), 16);
}

function rand255() {
  return intToHex(Math.floor(255 * Math.random()));
}

function randColor() {
  return [rand255(), rand255(), rand255()];
}

function multiColor(color, num) {
  var all = [];
  for (var i = 0; i < num; i++) {
    all = all.concat(color);
  }
  return all;
}

var COLOR_SUNLIGHT = [0xFF, 0xE0, 0xE0];

var patterns = {
  "lightning": function () {
    var col = Math.floor(Math.random() * LED_COUNT_NUM_COLS);
    return [
      [0,   new ColorArray().setCol(col, [0xDD, 0xDD, 0xDD]), 0],
      [10,  new ColorArray().setCol(col, [0x50, 0x50, 0x50]), 0],
      [0,   new ColorArray().setCol(col, [0xFF, 0xFF, 0xFF]), 0],
      [200, new ColorArray(), function () {return 1000 + 2000*Math.random()}],
    ]
  },
  "sunny": [[1000, new ColorArray().setAll(COLOR_SUNLIGHT), 1000]],
  "sunset": function() {
    var sunsetDarkColor = Color().rgb([0xFA, 0xD6, 0xA5]).darken(0.7).saturate(0.3).rgbArray();
    var array = [
      [300, new ColorArray().setAll(COLOR_SUNLIGHT), 700],
      [1000, new ColorArray().setAll(Color().rgb([0xFA, 0xD6, 0xA5]).darken(0.6).rgbArray()), 500], // https://en.wikipedia.org/wiki/Sunset_%28color%29
      [1000, new ColorArray()
        .setAll(   Color().rgb([0xFA, 0xD6, 0xA5]).darken(0.95).rgbArray())
        .setCol(0, sunsetDarkColor)
      , 500]
    ];

    for (var i = 4; i > 0; i--) {
      var ca = new ColorArray();
      ca.setCol(0, sunsetDarkColor);
      for (var j = 4; j >= i; j--) {
        ca.setAt(0, j, [0x00, 0x00, 0x00]);
      }
      array.push([300, ca, 250]);
    }

    array.push([0, new ColorArray(), 1000]);
    
    return array;
  },
  "cloudy": function() {
    var threshold = 0xE0;

    var start = {
      row: Math.random() * LED_COUNT_NUM_ROWS,
      col: Math.random() * LED_COUNT_NUM_COLS
    }
    var end = {
      row: Math.random() * LED_COUNT_NUM_ROWS,
      col: Math.random() * LED_COUNT_NUM_COLS
    }

    var getCloudRow = function (col) {
      return start.row + (end.row - start.row) / (end.col - start.col) * (col - start.col)
    }

    var arrays = [];

    for (var cloudCol = 0; cloudCol < LED_COUNT_NUM_COLS; cloudCol += 0.3) {
      var cloudRow = getCloudRow(cloudCol);
      var ca = new ColorArray();
      for (var col = 0; col < LED_COUNT_NUM_COLS; col++) {
        for (var row = 0; row < LED_COUNT_NUM_ROWS; row++) {
          var distance = Math.sqrt(Math.pow(row - cloudRow, 2) + Math.pow(col - cloudCol, 2));
          var value = intToHex(Math.min(threshold, Math.pow(distance, 2) * 10));
          ca.setAt(col, row, [value, value, value]);
        }
      }
      arrays.push([300, ca, 300]);
    }

    arrays.push([500, new ColorArray().setAll(Color().rgb([threshold, threshold, threshold]).darken(0.3).rgbArray()), 1000 + Math.random() * 2000]);

    return arrays;
  },
};

function getData(duration, colors) {
  var dataArray = [duration].concat(colors);
  return cobs.encode(new Buffer(dataArray));
}

function colorsToString(colors) {
  var allStrings = [];
  for (var i = 0; i < colors.length / 3; i++) {
    var string = "#";
    for (var j = 0; j < 3; j++) {
      var addString = colors[i * 3 + j].toString(16);
      if (addString.length < 2) {
        addString = "0" + addString;
      }
      string += addString;
    }
    allStrings.push(string);
  }
  return allStrings.join(" ");
};

function loopRun(array, i, done) {
  if (i >= array.length) 
    return done();

  var duration = array[i][0];
  if (typeof duration === 'function') duration = duration();

  var colors = array[i][1];
  if (typeof colors === 'function') colors = colors();

  var hold = array[i][2];
  if (typeof hold === 'function') hold = hold();

  var next = function () {
    var delay = duration + hold;
    setTimeout(function () {
      loopRun(array, i + 1, done);
    }, delay);
  };

  if (!DEBUG) {
    var data = colors.toData(duration);
    serialPort.write(data);
    serialPort.write([0x00]);

    // serialPort.drain(function () {
    //   next();
    // });

    next();
  } else {
    console.log("Duration: " + duration);
    console.log("Colors:   " + colors.toString());
    console.log("Hold:     " + hold);
    console.log();

    next();
  }
}

function loop(err) {
  var duration = 500;

  if (err) console.log(err);
  // var color = randColor();

  array = patterns["sunset"];
  if (typeof array === 'function') array = array();

  loopRun(array, 0, function () {
    if (!DEBUG)
      serialPort.drain(loop);
    else
      loop();
  });
}

if (!DEBUG) {
  console.log("Connecting to " + PORT + "...");
  serialPort.on("open", function () {
    console.log("Connected");

    serialPort.on('data', function(data) {
      console.log('data received: ' + data);
    });

    serialPort.write([0x00]);
    serialPort.drain(loop);
  });
} else {
  loop();
}
