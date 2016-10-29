(function () {
	'use strict';

	//global-ish declarations
	var VR,
		NoSleep = require('nosleep').NoSleep,
		isMobile = require('ismobilejs');

	function initRequirements() {
		//load styles
		require('!style!css!./css/style.css');

		VR = require('./vr');
	}

	function initialize() {
		initRequirements();

		//todo: set up button/info elements

//		VR.init();

        VR.noSleep = new NoSleep();
		window.addEventListener('resize', VR.resize, false);

		if (!isMobile.any) {
			VR.disableOrientation();
		}

		/*
		export global things
		*/
		window.VR = VR;
		window.THREE = VR.THREE;
	}

	initialize();
//	VR.start();
}());
