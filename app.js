var AWS                    = require('aws-sdk'),
    request                = require('request'),
    enviromentAwsRegionMap = require("./enviromentAwsRegionMap.json"),
    airTrafficControlUrl   = "http://localhost:3000/",
    currentEnviroment      = "next"

AWS.config.region = enviromentAwsRegionMap[currentEnviroment]

getInstancesFromAws ( function (instances) {
  whatsMissingFromWatchlist (instances, function (missingInstances) {
    rebuildWhatsMissing (missingInstances)
  })
})

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
              instances.push ( { "project":project, "serverType":serverType } )
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
    var isFound = false

    for (i in instances) {
      if (watchlist[w].project == instances[i].project && watchlist[w].serverType == instances[i].serverType ) {
        isFound = true
      }
    }

    if (!isFound) {
      missingInstances.push ( { "project":watchlist[w].project, "serverType":watchlist[w].serverType } )
    }
  }

  callback (missingInstances)
}

function rebuildWhatsMissing (missingInstances) {
  for (m in missingInstances) {
    var build_url = airTrafficControlUrl + "build/" + currentEnviroment + "/" + missingInstances[m].project
    console.log ("Building: " + missingInstances[m].project)

    request(build_url, function (error, response, body) {
      if (error) {
        console.log (error)
      } else if (response.statusCode == 200) {
        console.log(body)
      }
    })
   }  
}