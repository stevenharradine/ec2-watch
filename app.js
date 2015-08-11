var CONFIG                 = require("./config"),
    AWS                    = require('aws-sdk'),
    request                = require('request'),
    Slack                  = require("node-slack");
    slack                  = new Slack("https://hooks.slack.com/services/" + CONFIG.SLACK_TOKEN);

AWS.config.region = CONFIG.ENVIROMENT_AWS_REGION_MAP[CONFIG.CURRENT_ENVIROMENT]

runProgram ()

function runProgram () {
  getInstancesFromAws ( function (instances) {
    whatsMissingFromWatchlist (instances, function (missingInstances) {
      rebuildWhatsMissing (missingInstances, function () {
        startOver ()
      })
    })
  })
}

function getInstancesFromAws (callback) {
  var instances = Array ()

  new AWS.EC2().describeInstances(function(error, data) {
    if (error) {
      console.log(error)
    } else {
      for (i in data.Reservations) {
        for (j in data.Reservations[i].Instances) {
          for (k in data.Reservations[i].Instances[j].SecurityGroups) {
            var groupsDivided = data.Reservations[i].Instances[j].SecurityGroups[k].GroupName.split("-"),
                project       = groupsDivided.splice(0, groupsDivided.length - 1).join('-'),
                serverType    = groupsDivided.splice(groupsDivided.length - 1)[0]

            if (serverType != "managed") {  // filter out managed
              instances.push ({
                "project":project,
                "serverType":serverType
              })
            }
          }
        }
      }

      callback (instances)
    }
  })
}

function whatsMissingFromWatchlist (instances, callback) {
  var missingInstances = Array (),
      watchlist        = require("./watchlist.json")

  for (w in watchlist) {
    var isFound = false,
        slackMessage = "Missing " + watchlist[w].project + " (" + watchlist[w].serverType + ") in " + CONFIG.CURRENT_ENVIROMENT

    for (i in instances) {
      if (watchlist[w].project == instances[i].project && watchlist[w].serverType == instances[i].serverType ) {
        isFound = true
      }
    }

    if (!isFound) {
      missingInstances.push ({
        "project":watchlist[w].project,
        "serverType":watchlist[w].serverType
      })
      sendSlack (slackMessage, "#skynet");
    }
  }

  callback (missingInstances)
}

function sendSlack (message, channel) {
  slack.send({
    text: message,
    channel: channel,
    username: "EC2 Watch"
  }, function (error) {
    if (error != null && error.message != null) {
      console.log ("Slack: " + error.message);
    }
  });
}

function rebuildWhatsMissing (missingInstances, callback) {
  if (missingInstances.length != 0) {
    build (CONFIG.CURRENT_ENVIROMENT, missingInstances, 0, callback)  // start recusive call to iterate through the chain
  } else {
    callback ()
  }
}

function build (enviroment, missingInstances, m, callback) {
  console.log ("Building: " + missingInstances[m].project)

  var build_url = CONFIG.AIR_TRAFFIC_CONTROL_URL + enviroment + "/build/" + missingInstances[m].project

  request(build_url, function (error, response, body) {
    if (error) {
      console.log (error)
    } else if (response.statusCode == 200) {
      console.log(body)
    }

    if (m == missingInstances.length -1) {   // when at the last element in the chain break out to the callback
      callback()
    } else {                                  // move to next element in the chain
      build (enviroment, missingInstances, ++m, callback);
    }
  }) 
}

function startOver () {
  console.log ("End of chain")
  
  setTimeout( function () {
    console.log ("Starting over ...")
    runProgram ()
  }, CONFIG.SET_RECURSIVE_DELAY)
}