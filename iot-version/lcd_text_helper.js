/* global require: false, process: false, setInterval: false, setTimeout: false, clearInterval: false, clearTimeout:false, module: false, console: false */

/**
 * Module exports.
 */

module.exports = LcdTextHelper;

/**
 * LcdTextHelper constructor.
 *
 * @param {Jhd1313m1} UPM I2C LCD instance
 * @api public
 */
function LcdTextHelper(lcd) {
  
  var TOTAL_LCD_ROWS = 2;
  var TOTAL_LCD_COLUMNS = 16;
  var KEEP_TEXT_ON_SCREEN_DELAY = 2000;     // in ms
  var TEXT_UPDATE_INTERVAL = 550;           // in ms, should be less than TEXT_DRAW_INTERVAL
  var TEXT_DRAW_INTERVAL = 500;             // in ms, should be more than TEXT_UPDATE_INTERVAL
  var REPEATING_TEXT_PADDING = "    ";      // whitespace between looping message when text is scrolling
  var BLANK_ROW_TEXT = "                ";  // exactly 16 space characters

  var lcdRows = []; //var EXAMPLE_ROW_OBJECT = { displayText: BLANK_ROW_TEXT, updateDisplayTextIntervalId: 0 };
  var startScrollingTimeoutId = 0;
  var drawIntervalId = 0;

  /**
   * Takes array of message strings to display. 
   * Later uses string lengths to set text on LCD with or without scrolling.
   *
   * @param {string[]} messages - Each string in the array corresponds to a row on the LCD.
   * @api public
   */
  function set(messages){
    
    reset();
    
    messages = messages || []; // default, empty array
    if (messages.length > TOTAL_LCD_ROWS) {
      console.log("This LCD screen only supports %s rows of text but you tried to give me %s", TOTAL_LCD_ROWS, messages.length);
      messages.length = TOTAL_LCD_ROWS; // truncate array, if needed
    }
    
    for (var row=0; row<messages.length; row++) {
      var msg = messages[row];    
      if (msg.length < TOTAL_LCD_COLUMNS) {
        msg = msg + BLANK_ROW_TEXT.slice(msg.length); // fill in any remaining gaps with spaces
      } else if (msg.length > TOTAL_LCD_COLUMNS) {
        msg = msg + REPEATING_TEXT_PADDING; // add padding for looping text
      }

      // create a new slot in lcdRows to save the display string
      // (and later save any scrolling interval timer IDs)
      lcdRows[row] = {displayText: msg};
    }

    // immediately draw text to LCD then, after a slight startup delay, start scrolling effect 
    draw();
    startScrollingTimeoutId = setTimeout(startScrolling, KEEP_TEXT_ON_SCREEN_DELAY);
  }

  /**
   * Checks length of display text strings and, if long enough for scrolling, will:
   * - Add a timer interval for each row to update the string value to give illusion of scrolling.
   * - Add a timer interval to re-draw all strings to the LCD.
   *
   * @api private
   */
  function startScrolling() {
    var totalScrolling = 0;
    
    for (var r=0; r<lcdRows.length; r++) {
      if (lcdRows[r].displayText.length > TOTAL_LCD_COLUMNS) {
        lcdRows[r].updateDisplayTextIntervalId = setInterval(updateScrollingRow, TEXT_UPDATE_INTERVAL, r);
        totalScrolling++;
      }
    }
    
    if (totalScrolling > 0) {
      drawIntervalId = setInterval(draw, TEXT_DRAW_INTERVAL);
    }
  }
  
  /**
   * Takes the first character of the display string and moves it to the end
   * of the string to give the illusion of scrolling.
   *
   * @api private
   */
  function updateScrollingRow(row){
    var currentText = lcdRows[row].displayText;
    var shiftedText = currentText.slice(1) + currentText.slice(0, 1);
    lcdRows[row].displayText = shiftedText;    
  }

  /**
   * Draws all display strings to the LCD
   *
   * @api private
   */
  function draw() {
    //console.log("----------------");
    for (var r=0; r<lcdRows.length; r++) {
      var text = lcdRows[r].displayText.slice(0, TOTAL_LCD_COLUMNS);
      //console.log(text);
      lcd.setCursor(r, 0);
      lcd.write(text);   
    }
  }

  /**
   * Clear LCD screen and clear any timer events that might try to write to the screen
   *
   * @api public
   */
  function reset() {
    
    // write blank rows instead of lcd.clear()
    // which takes too long to execute and messes up drawn text sometimes
    lcd.setCursor(0, 0);
    lcd.write(BLANK_ROW_TEXT);
    lcd.setCursor(1, 0);
    lcd.write(BLANK_ROW_TEXT);
    
    clearInterval(drawIntervalId);
    clearTimeout(startScrollingTimeoutId);
    for (var r=0; r<lcdRows.length; r++) {
      var rowObject = lcdRows[r];
      clearInterval(rowObject.updateDisplayTextIntervalId);
    }
    lcdRows.length = 0;
  }
  
  /**
   * Return public methods for module.exports.
   */
  return {
    set: set,
    reset: reset
  };

}