var path   = require('path')
  , dgram  = require('dgram')
  , test   = require('tap').test
  , lynx   = require('../lib/lynx')
  , macros = exports
  ;

//
// Percentage allowed for errors in aproximations
// Like, duration is around 100ms. Means for 10% error can be 10ms.
//
var MAX_APROX_ERROR = process.env.MAX_APROX_ERROR
                    ? parseInt(MAX_APROX_ERROR, 10)
                    : 10
                    ;

//
// Set the server port
//
macros.udpServerPort = 9753;

//
// Create a connection
//
macros.connection = new lynx('localhost', macros.udpServerPort);

//
// ### function mockUdpServer(testName, onTest)
// #### @testName {String} The test that is calling this, so we can load
//      the respective fixture
// #### @onTest   {Function} Function that returns the result of a specific
//      test
//
// Start a `udp` server that will expect a certain order of events that is
// mocked in `fixtures`
//
macros.udpServer = function udpServer(testName, onTest) {
  //
  // Set the path for the fixture we want to load
  //
  var fixturePath = path.join("fixtures", testName + ".json");

  //
  // Try to load the fixture.
  // This will break your program if you delete by mistake
  //
  var fixture = require("./" + fixturePath);

  //
  // The number of requests we expect to get
  //
  var nrRequests = fixture.length
    , iRequests  = 0
    ;

  //
  // Create a UDP Socket
  //
  var socket = dgram.createSocket("udp4", function (message, remote) {
    //
    // We got another one
    //
    iRequests++;

    //
    // We expect the first item in our fixture
    //
    var expected = fixture.shift();

    //
    // `remote.address` for remote address
    // `remote.port` for remote port
    // `remote.size` for data lenght
    // `message.toString('ascii', 0, remote.size)` for textual contents
    //
    var actual  = message.toString('ascii', 0, remote.size);

    //
    // Return our test results
    //
    onTest(actual === expected, { expected: expected, actual: actual });

    //
    // If we are done close the server
    //
    if(iRequests === nrRequests) {
      socket.close();
    }
  });

  //
  // Listen in some (not so) random port
  //
  socket.bind(macros.udpServerPort, 'localhost');
};

//
// ### function matchFixturesTest(testName, onTest)
// #### @resource {String} The resource we are testing (gauges, sets, counts)
// #### @f        {Function} The actual udp client calls to be received by
//      our mock server
//
// 1.   Loads fixtures for this resource and checks how many client requests
//      are going to exist
// 2.   Runs a tests that:
// 2.1. Start a `udp` server that will expect a certain order of events that
//      is mocked in `fixtures`
// 2.2. Runs client code that should match what has been mocked
//
macros.matchFixturesTest = function genericTest(resource, f) {
  var nrTests = require('./fixtures/' + resource).length;

  //
  // All of our counting tests
  //
  test(resource + " test", function (t) {
    //
    // Plan for as many tests as we have fixtures
    // 
    t.plan(nrTests);

    //
    // Setup our server
    //
    macros.udpServer(resource, function onEachRequest(err, info) {

      //
      // Aproximation
      //
      if(info.expected.indexOf("~") !== -1) {
        console.log("A", info)
        //
        // foobar : ~ 10     |ms
        // /(.*)? : ~ (.*)? \|ms/
        //
        // ? means non eager, like don't eat multiple `:`.
        //
        var match = /(.*)?:~(.*)?\|ms/.exec(info.expected);
        if(match && typeof match[2] === "string") {
          //
          // Get our aproximate number
          //
          var aproximation = parseInt(match[2], 10);

          //
          // Our upper bound
          //
          var ubound = aproximation + (aproximation * MAX_APROX_ERROR / 100);

          t.ok(ubound >= aproximation, "value deviated from " + aproximation +
           "by more than +" + MAX_APROX_ERROR + "%.");

          //
          // Our lower bound
          //
          var lbound = aproximation - (aproximation * MAX_APROX_ERROR / 100);

          t.ok(lbound <= aproximation, "value deviated from " + aproximation +
            "by more than -" + MAX_APROX_ERROR + "%.");
        }
        else {
          //
          // Just treat it like any other thing.
          // but hey, that fixture is wrong dude!
          //
          t.equal(info.expected, info.actual);
        }
      }
      //
      // On each response check if they are identical
      //
      else {
        console.log("AB")
        t.equal(info.expected, info.actual);
      }
    });

    //
    // Run our client code
    //
    f(macros.connection);
  });
};

//
// Export simple `tap` tests
//
macros.test = test;