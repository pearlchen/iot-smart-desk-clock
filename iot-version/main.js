/* global require: false, process: false, setInterval: false, setTimeout: false, clearInterval: false, clearTimeout:false, module: false, console: false */

/**
 * Module dependecies.
 */

var mraa = require('mraa');
/*
If you get any mraa missing errors, run this on your board:
$  echo "src mraa-upm http://iotdk.intel.com/repos/1.1/intelgalactic" > /etc/opkg/mraa-upm.conf
$  opkg update
$  opkg install libmraa0
*/

var jsUpmI2cLcd  = require ('jsupm_i2clcd');
/*
If you get any upm missing errors, run this on your board:
$  opkg install upm
*/

var LcdTextHelper = require('./lcd_text_helper');
var GoogleCalendarEventFetcher = require('./google_calendar_event_fetcher');
/*
If you don't already have these 2 files, 
download both lcd_text_helper.js and google_calendar_event_fetcher.js from:
https://github.com/pearlchen/iot-smart-desk-clock/tree/master/iot-version
*/

/**
 * Initialization.
 */

// Initialize the LCD.
// The 1st param is the BUS ID:
//   Intel Edison: Use 6
//   Intel Galileo Gen 2: Use 6 (TODO: unconfirmed)
//   Intel Galileo Gen 1: Use 0
var lcd = new jsUpmI2cLcd.Jhd1313m1(6, 0x3E, 0x62);

// Initialize the helper libraries
var lcdText = new LcdTextHelper(lcd);
var calendar = new GoogleCalendarEventFetcher();

var PRE_TIME_WARNING = 20; // in minutes, amount of time before event to begin notifying
var POST_TIME_WARNING = 15; // in minutes, amount of time after event to pay attention
// TODO: could personalize PRE_TIME_WARNING based on reminders already set. 
// See developers.google.com/google-apps/calendar/concepts#reminders

var MAX_EVENTS = 5; // number of events to get
var now; // to store Date.now() when getting events

/**
 * Main code.
 */

showStartUpMessage();
calendar.init(getEvents, showErrorOnLcd);

/**
 * Show "bootup" message.
 */
function showStartUpMessage(){
  lcdText.set([
    "Checking for", 
    "events..."
  ]);
}

/**
 * Get the next 5 events on the user's primary calendar within a start and end time
 */
function getEvents() {
  now = new Date(); //TODO: Add unit tests with various dates
  var tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1); // Note to self: yes, it'll still work if it's the last day of the month
  calendar.getEvents(eventsReceived, MAX_EVENTS, now.toISOString(), tomorrow.toISOString());
}

/**
 * Shows an error message string on LCD screen.
 *
 * @param {string} errorMessage - The message to display on LCD.
 */
function showErrorOnLcd(errorMessage){
  lcdText.set([
    errorMessage
  ]);
}

/**
 * Parse through returned calendar event list from Google Calendar API call.
 *
 * @param {Object[]} events - Array of Google Calendar Event Objects.
 * See developers.google.com/google-apps/calendar/v3/reference/events/list for properties.
 */
function eventsReceived(events){
  
  if (events.length === 0) {
    console.log('eventsReceived() called with no upcoming events.');
    lcdText.set([
      "No upcoming", 
      "events"
    ]);
  } else {
    console.log("eventsReceived() called with %s events found.", events.length);
    for (var i=0; i<events.length; i++) {
      var event = events[i];
      var start = new Date(event.start.dateTime);

      // time calculations
      var timeUntilEvent = Math.floor((start.getTime() - now.getTime())/60000); // calculate difference and convert ms to minutes
      
      // augment current event object with descriptive properties:
      // (will make it easier to figure out display logic later)
      event.timeUntilEvent = timeUntilEvent;
      event.almostTime = (timeUntilEvent > 0 && timeUntilEvent <= PRE_TIME_WARNING);
      event.startingNow = (timeUntilEvent === 0);
      event.alreadyStarted = (timeUntilEvent < 0);
      event.onlyJustStarted = (event.alreadyStarted && Math.abs(timeUntilEvent) <= POST_TIME_WARNING);
      event.futureImportant = (event.almostTime || event.startingNow || event.alreadyStarted);
     
      // debugging:
      //console.log("%s:", event.summary )
      //console.log("  Time diff: %s minutes", event.timeUntilEvent);
      //console.log("  Almost time to start warning?", event.almostTime);
      //console.log("  Starting now?", event.startingNow);
      //console.log("  Already started? %s (Just started? %s)", event.alreadyStarted, event.onlyJustStarted);
    }

    // TODO: Only update if there's a change in time/title of the event
    // TODO: consider the consistency of params being passed (obj vs array, etc)
    var displayEvent = getDisplayEvent(events);
    updateLcd(displayEvent);
  }
  
  // poll for updates
  // TODO: switch to push notifications to save on traffic: developers.google.com/google-apps/calendar/v3/push
  // TODO: or maybe use watch: developers.google.com/google-apps/calendar/v3/reference/events/watch
  setTimeout(getEvents, 60000); // every min
  //setTimeout(getEvents, 45000); // every 45 seconds
  //setTimeout(getEvents, 15000); // for demo purpose, make it quicker like every 15 sec
}

/**
 * Based on parsed calendar events, figure out which one is most important to display.
 *
 * @param {Object[]} events - Array of Google Calendar Event Objects 
 *                            *plus* augmented properties from parsing.
 * @returns {Object} event - Object containing display info
 * @returns {Object} event.msg - LCD display text (msg.row1, msg.row2)
 * @returns {Object} event.color - LCD backlight color (color.r, color.g, color.b)
 */
function getDisplayEvent(events){

  var msg = {};
  var firstEvent;
  var i = 0;
  
  // Get rid of any events that have already started
  // (except the most recently started event):
  for (i=events.length-1; i>0; i--) {
    if (events[i].alreadyStarted && events[i].timeUntilEvent > events[i-1].timeUntilEvent) {
      events = events.slice(i);
      //console.log("** sliced events array. New length: %s", events.length);
      break;
    }
  }
  
  // Create default display entry based on first entry:
  firstEvent = events[0];
  if (firstEvent.startingNow) {
    msg.row1 = firstEvent.summary;
    msg.row2 = "is starting NOW.";
  } else if (firstEvent.alreadyStarted) {
    msg.row1 = firstEvent.summary;
    msg.row2 = "started " + Math.abs(firstEvent.timeUntilEvent) + "m ago.";
  } else {
    msg.row1 = firstEvent.timeUntilEvent + "m until";
    msg.row2 = firstEvent.summary;
  }
  
  if (events.length > 1 ) {
    
    // Handle 2 (or more) events scheduled at the same time:
    var eventsAtSameTime = 0;
    i = 1;
    for (i=1; i<events.length; i++) {
      if (events[i].timeUntilEvent === firstEvent.timeUntilEvent) {
        eventsAtSameTime++;
      } else {
        // if not, all double-booked events already found so get out of this loop.
        //console.log("** break out of double-book check at %s", i);
        // plus look ahead to next event to see if it's more important
        // e.g. current event(s) already started but next event is in 5 minutes:
        if (firstEvent.alreadyStarted && events[i].futureImportant){
          // if so, re-try getting display info with only future events
          // need to do this recursively otherwise next event could be a double-booked event
          //console.log("** re-try with events > i=%s", i);
          var displayEvent = getDisplayEvent(events.slice(i));
          return displayEvent;
        }
        break;
      }
    }
    
    // Override display message when 2 (or more) events scheduled at same time:
    if (eventsAtSameTime > 0){
      var totalEvents = eventsAtSameTime + 1;
      if (firstEvent.startingNow) {
        msg.row1 = totalEvents + " events are";
        msg.row2 = "starting NOW.";
      } else if (firstEvent.alreadyStarted) {
        msg.row1 = totalEvents + " events";
      } else {
        msg.row2 = totalEvents + " events start.";
      }
    }
    
  }
  
  // finally, figure out what backlight color to use on LCD
  var event = {
                msg: msg, 
                color: getLcdColor(firstEvent.timeUntilEvent)
              };  
  return event;
}

/**
 * Get an RGB color LCD with message and update backlight color.
 *
 * @param {number} time - An signed int representing time to event in minutes
 * @returns {Object} color - Object representing the RGB color to use for LCD
 * @returns {number} color.r - Red value.
 * @returns {number} color.g - Green value.
 * @returns {number} color.b - Blue value.
 */
function getLcdColor(time){
  
  var preColorIncrements = Math.round(255/PRE_TIME_WARNING);
  var postColorIncrements = Math.round(255/POST_TIME_WARNING);
  var r = g = b = 255; // default color: white
  
  if (time <= 0 && Math.abs(time) <= POST_TIME_WARNING) {
    // dark green to light green
    r = b = 255 - ((POST_TIME_WARNING - Math.abs(time)) * postColorIncrements);
  } else if ( time > 0 && time <= PRE_TIME_WARNING) {
    // yellow (255,255,0) to organge (255,125,0) to red (255,0,0)
    b = 0;
    g = 255 - ((PRE_TIME_WARNING - time) * preColorIncrements);
  }
  
  color = {r:r, g:g, b:b}; 
  return color;
}

/**
 * Update LCD with message and update backlight color.
 *
 * @param {Object} event - Object representing text to display on LCD
 * @param {Object} event.msg - Object representing text to display on LCD
 * @param {Object} event.color - Object representing the RGB color to use for LCD (see getLcdColor())
 */
function updateLcd(event){
  console.log("Display: %s %s @%s,%s,%s", event.msg.row1, event.msg.row2, event.color.r, event.color.g, event.color.b);
  console.log("---------");
  lcdText.set([
    event.msg.row1, 
    event.msg.row2
  ]);
  lcd.setColor(event.color.r, event.color.g, event.color.b);
}
