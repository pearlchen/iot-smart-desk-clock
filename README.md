# IoT Smart Desk Clock

Imagine if you will, a smart clock that automatically checks for your next calendar event. 

When the clock knows an event is coming up, it automatically gives you a contextual countdown to the event start time (e.g. "45 minutes to your meeting" vs. "Meeting starts at 4pm"). And as the event start time draws closer, the clock gently alerts you to the urgency of when you need to get moving by changing colour. (e.g. Yellow means "be mellow", orange means "get on it", and red means "danger zone".)

Well, don't imagine. Make it today!

I call this clock the "Intel-ligent Clock" because it's powered by the Intel Edison!

![Intel-ligent Clock by Pearl Chen](https://github.com/pearlchen/iot-smart-desk-clock/blob/master/intel-ligent_clock_by_pearl_chen.png)

## Tutorial

This repo contains the companion project code for the "Make an intelligent desk clock powered by the Intel Edison" Instructables tutorial. [Follow the tutorial.](http://www.instructables.com/id/Make-an-intelligent-desk-clock-powered-by-the-Inte/)

## Roadmap

* Add unit tests for testing various dates against various events
* Place the LCD Text Helper library on NPM so you can install it via the command line
* Add support for multiple calendars (or calendar accounts)
* Add ability to configure calendar accounts from your desktop or mobile phone via a web browser during setup
* Add an Adafruit NeoPixel ring to act as a regular clock (with the benefit of having extra LEDs to grab your attention for during the countdown)
* Factor in walking/biking/transit/driving time to the countdown. 

## Bugs

Please post any bugs or questions to the [issue tracker](https://github.com/pearlchen/iot-smart-desk-clock/issues). Pull requests welcome but, for anything beyond typos, please open an issue ticket first to discuss.