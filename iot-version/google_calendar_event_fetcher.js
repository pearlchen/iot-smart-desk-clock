/* global require: false, process: false, setInterval: false, setTimeout: false, clearInterval: false, clearTimeout:false, module: false, console: false */

/**
 * Module dependecies.
 */

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var calendar = google.calendar('v3');

/**
 * Module exports.
 */

module.exports = GoogleCalendarEventFetcher;

/**
 * GoogleCalendarEventFetcher constructor.
 *
 * @api public
 */
function GoogleCalendarEventFetcher(){

  /*
  When using XDK's run command, it runs app outside of project directory
  so use an absolute path.
  
  If you need to clear a saved token, run this on your board:
  $ rm /home/root/.credentials/calendar-api-quickstart.json
  */
  var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
  var SECRET_FILE = '/node_app_slot/client_secret.json'; 
  var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
      process.env.USERPROFILE) + '/.credentials/'; 
  var TOKEN_PATH = TOKEN_DIR + 'calendar-api-quickstart.json';
  var oauth2Client;
  
  /**
   * Use as a default callback method to display any errors to console log.
   *
   * @param {string} errorMsg - A single text string to output.
   * @api private
   */
  var errorCb = function(errorMsg){
    console.log(errorMsg);
  };
  
  /**
   * Load client secrets from a local file.
   *
   * @param {requestCallback} callback - The callback to call after authorization.
   
   * @api public
   */
  function init(callback, errorCallback){
    
    // augment the current error callback method
    if ( errorCallback ) {
      errorCb = function(errorMsg){
        console.log(errorMsg);
        errorCallback(errorMsg);
      };
    }
    
    fs.exists(SECRET_FILE, function (exists) {
      if (exists){
        fs.readFile(SECRET_FILE, function processClientSecrets(err, content) {
          if (err) {
            errorCb('Error loading client secret file: ' + err);
            return;
          }
          // Authorize a client with the loaded credentials
          authorize(JSON.parse(content), callback);
        });
      }else{
        errorCb('Client secret file doesn\'t exist');
      }
    });
  }
  
  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   *
   * @param {Object} credentials - The authorization client credentials.
   * @param {requestCallback} callback - The callback to call after authorization.
   * @api private
   */
  function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();

    oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
      if (err) {
        getNewToken(oauth2Client, callback);
      } else {
        oauth2Client.credentials = JSON.parse(token);
        callback();
      }
    });
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   *
   * @param {google.auth.OAuth2} oauth2Client - The OAuth2 client to get token for.
   * @param {requestCallback} callback - The callback to call after authorization.
   * @api private
   */
  function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });
    errorCb('Authorize app in console by visiting url.');
    console.log("----------------");
    console.log(authUrl);
    console.log("----------------");
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
      rl.close();
      oauth2Client.getToken(code, function(err, token) {
        if (err) {
          errorCb('Error while trying to retrieve access token', err);
          return;
        }
        oauth2Client.credentials = token;
        storeToken(token);
        callback();
      });
    });
  }

  /**
   * Store token to disk be used in later program executions.
   *
   * @param {Object} token - The token to store to disk.
   * @api private
   */
  function storeToken(token) {
    try {
      fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
  }

  /**
   * Gets the next events on the user's primary calendar.
   *
   * @param {requestCallback} callback - The callback to call after authorization.
   * @param {number} maxResults - The number of events to *try* and get.
   * @param {ISOString} timeMin - Miniumum time frame to start event query.
   * @param {ISOString} timeMax - Maxiumum time frame to end event query.
   * @api public
   */
  function getEvents(callback, maxResults, timeMin, timeMax) {
    callback = callback || function(){};
    maxResults = maxResults || 5;
    timeMin = timeMin || (new Date()).toISOString();
    timeMax = timeMax || undefined;
    
    if (!oauth2Client) {
      errorCb("Authorize calendar first by calling init().");
      return; 
    }
    
    calendar.events.list({
      auth: oauth2Client,
      calendarId: 'primary',
      timeMin: timeMin,
      timeMax: timeMax,
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime'
    }, function(err, response) {
      if (err) {
        errorCb("Cannot connect to calendar.");
        console.log(err);
        return;
      }
      
      // Success getting event list.
      // For more response properties, see:
      // https://developers.google.com/google-apps/calendar/v3/reference/events/list 
      callback(response.items);
    });
  }
  
  /**
   * Return public methods for module.exports.
   */
  return {
    init: init,
    getEvents: getEvents 
  };
}
