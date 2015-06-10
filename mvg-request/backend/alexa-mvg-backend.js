/**
 * Alexa App -- MVG Transit Info -- Backend
 * Author: Christoph Graumann (github@cmastrg.com)
 * Version: 0.1
 * License: MIT
 */

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Uncomment this if statement and replace application.id with yours
         * to prevent other voice applications from using this function.
         */
        /*
        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.[unique-value-here]") {
            context.fail("Invalid Application ID");
        }
        */

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                        context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        }  else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                         context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);

            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId
                + ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the app without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId
                + ", sessionId=" + session.sessionId);

    getWelcomeResponse(callback);
}

/** 
 * Called when the user specifies an intent for this application.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId
                + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    if ("NextTrain" === intentName) {
        getStationDepartures(intent, session, callback);
    } else if ("NextLocalTrain" === intentName) {
        getLocalDepartures(intent, session, callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the app returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId
                + ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

/**
 * Helpers that build all of the responses.
 */
function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    }
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "0.1",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    }
}

/** 
 * Functions that control the app's behavior.
 */
function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "Welcome to the Munich Transit Info app. "+
                        "You request the next train departure time for a specific station or your home station.";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    var repromptText = "For which station do you want to get the upcoming departures?";
    var shouldEndSession = false;

    callback(sessionAttributes,
             buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function getStationDepartures(intent, session, callback) {
    var stationSlot = intent.slots.Station;
    var destinationSlot = intent.slots.Destination;
    var speechOutput = "";

    if (stationSlot) {
        station = stationSlot.value;
         if (destinationSlot) {
            speechOutput = "I cannot yet handle destinations. Try simply asking for the next train!";
            repromptText = "I didn' get that. You can ask when the next train leaves at a station.";
            callback({}, buildSpeechletResponse("MVG Station", speechOutput, repromptText, false));
        } else {
            receiveMvgDepartures(station,respondDepartureResult, callback);
        }
 
    } else {
        speechOutput = "I'm not sure which station you asked for, please try again";
        repromptText = "I didn' get that. You can ask when the next train leaves at a station.";
        callback({}, buildSpeechletResponse("MVG Station", speechOutput, repromptText, false));
    }
}

function getLocalDepartures(intent, session, callback) {
    var speechOutput = "";

    station = "Freimann"; // Currently hard coded. TODO: store some user stations
    receiveMvgDepartures(station,respondDepartureResult, callback);
}

function respondDepartureResult(data,callback) {
    if (!data.station) {
        speechOutput = "I could not receive information from the transit system, please try again later.";
    } else {
        nextTrain = data.result_sorted[0];
        speechOutput = "The next train at "+data.station
                        +" is the "+nextTrain.line
                        +" to "+nextTrain.destination
                        +" and leaves in "+nextTrain.minutes
                        +" minutes.";
    }
    
    callback({}, buildSpeechletResponse("MVG Station", speechOutput, "repromptText", true));
}

function receiveMvgDepartures(station, callback, finalCallback) {
    var util  = require('util'),
    spawn = require('child_process').spawn,
    mvg    = spawn('mvg_json', [station]);

    mvg.stdout.on('data', function (data) {        
        callback(JSON.parse(data),finalCallback);
    });
}