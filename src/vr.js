(function () {
	'use strict';

	//constants
	var NEAR = 1,
		FAR = 1000000,

	//global-ish declarations
		THREE,
		eventEmitter,
		materials = require('./materials'),
		nop = function () {},
		requestFullscreen = nop,
		exitFullscreen = (
			document.exitFullscreen ||
			document.mozCancelFullScreen ||
			document.webkitExitFullscreen ||
			document.msExitFullscreen ||
			nop
		).bind(document),
	// Const
		MODE_CSS = 'css3d',
		MODE_CANVAS = 'canvas',

	//scene assets
		camera,
		scene,
		body,
		renderer,
		audioListener,
		vrControls,
		vrEffect,
		mouseControls,
		raycaster,
		target,

		bodyWrapper,
		cameraWrapper,

		floor,

	//state
		going = false,
		vrMode = false,
		orientationEnabled,
		orientationPossible = false,

	//exported object
		VR,

		VRObject = require('./vr-object'),
		objectMethods = [
			'box',
			'cylinder',
			'torus',
			'sphere',
			'empty',
			'sound',
			'floor',
			'sky',
			'panorama',
			'image',
			'video',
			'text',
			'grid'
		],

		//todo: use a weak map or set instead
		vrObjects = [],
		raycastable = [],

		lastTick = 0,
        waitRenderInative = 0,
		animationCallbacks = [];

    var isSupportWebgl = (function () {
        var canvas = document.createElement('canvas');
        var gl = null;
        var experimental = false;
        try {
            gl = canvas.getContext('webgl');
        } catch (x) {
            gl = null;
        }

        if (gl === null) {
            try {
                gl = canvas.getContext('experimental-webgl');
                experimental = true;
            } catch (x) {
                gl = null;
            }
        }
        return Boolean(gl);
    })();

    window.isSupportWebgl = isSupportWebgl;

	function isFullscreen() {
		return !!(document.fullscreenElement ||
			document.mozFullScreenElement ||
			document.webkitFullscreenElement ||
			document.msFullscreenElement);
	}

	function fullScreenError() {
		vrMode = false;
		if (vrEffect) {
			vrEffect.exit();
		}
	}

	function pruneObject(object) {
		var i = raycastable.indexOf(object);
		if (i >= 0) {
			raycastable.splice(i, 1);
		}

		i = vrObjects.indexOf(VRObject.findObject(object));
		if (i >= 0) {
			vrObjects.splice(i, 1);
		}

		object.children.forEach(pruneObject);
	}

	function raycast() {
		var i,
			intersect,
			object,
			intersects,
			parent,
			prune = [],
			vrObject;

		raycaster.ray.origin.setFromMatrixPosition(camera.matrixWorld); // world position
		raycaster.ray.direction.set(0, 0, 0.5).unproject(camera).sub(raycaster.ray.origin).normalize();

		intersects = raycaster.intersectObjects(raycastable, true);
		for (i = 0; i < intersects.length; i++) {
			intersect = intersects[i];

			// if object has been removed from scene, remove it from raycastable
			parent = intersect.object;
			while (parent && parent !== scene) {
				if (!parent.parent) {
					prune.push(parent);
				}
				parent = parent.parent;
			}

			if (parent && intersect.object instanceof THREE.Mesh) {
				object = intersect.object;
				break;
			}
		}

		prune.forEach(pruneObject);

		if (target !== object) {
			if (target) {
				vrObject = VRObject.findObject(target);
				vrObject.emit('lookaway');
				VR.emit('lookaway', vrObject);
			}
			target = object;
			if (target) {
				vrObject = VRObject.findObject(target);
				while (!vrObject && target.parent) {
					target = target.parent;
					vrObject = VRObject.findObject(target);
				}
				if (vrObject) {
					vrObject.emit('lookat', intersect);
					VR.emit('lookat', vrObject, intersect);
				}
			}
		}
	}

	function render() {
       // if (CLOSE_RENDER) {
       //     return;
       // }
        // Will not start render when application has been active.
        // The case only in taobao client. Very suck!
        if (Date.now() / 1000 - lastTick > 5) {
            if (waitRenderInative === 0) {
                waitRenderInative = Date.now() / 1000;
            }
            if (Date.now() / 1000 - waitRenderInative > 1) {
                lastTick = Date.now();
            }
            return;
        }
        waitRenderInative = 0;

		var now = Date.now() / 1000,
			delta = Math.min(1, now - lastTick);

		vrControls.update();

		animationCallbacks.forEach(function (cb) {
			cb(delta, now);
		});

		scene.updateMatrixWorld();

		vrObjects.forEach(function (object) {
			object.update(now);
		});
        if (mouseControls.autoRotate === true) {
            mouseControls.update();
        }

		raycast();

		vrEffect.render(scene, camera);

		lastTick = now;
	}

	function renderLoop() {
		if (going) {
			render();
			requestAnimationFrame(renderLoop);
		}
	}

	function stop() {
		going = false;
	}

	function start() {
		if (!going) {
			going = true;
			renderLoop();
		}
	}

	/*
	Mute any sounds when this browser tab is in the background or minimized.
	*/
	function visibilityChange() {
		if (document.hidden || document.mozHidden || document.msHidden || document.webkitHidden) {
			audioListener.volume(0);
		} else {
			audioListener.volume(1);
		}
	}

	function resize(width, height) {
		width = typeof width === 'number' && width || window.innerWidth;
		height = typeof height === 'number' && height || window.innerHeight;

		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
	}

	function initShake() {
		var lastTime = 0,
			lastX,
			lastY,
			lastZ,
			threshold = 15;

		window.addEventListener('devicemotion', function (evt) {
			var current = evt.accelerationIncludingGravity,
				time,
				diff,
				deltaX = 0,
				deltaY = 0,
				deltaZ = 0,
				dist;

			if (lastX !== undefined) {
				deltaX = Math.abs(lastX - current.x);
				deltaY = Math.abs(lastY - current.y);
				deltaZ = Math.abs(lastZ - current.z);

				// if (deltaX > threshold &&
				// 		(deltaY > threshold || deltaZ > threshold)
				// 	) {
				dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
				if (dist > threshold) {

					time = Date.now();
					diff = time - lastTime;
					if (diff > 1000) {
						if (navigator.vibrate) {
							navigator.vibrate(100);
						}

						lastTime = Date.now();

						VR.emit('shake');
					}
				}
			}

			lastX = current.x;
			lastY = current.y;
			lastZ = current.z;

			orientationPossible = true;
		}, false);
	}

	function initScene(mode) {
		function attachCanvas() {
			document.body.insertBefore(renderer.domElement, document.body.firstChild || null);
			resize();
		}

		if (renderer) {
			return;
		}
		var renderMode = mode || 'auto';
        if (renderMode === MODE_CSS) {
            renderer = new THREE.CSS3DRenderer();
        } else if (renderMode === MODE_CANVAS) {
            renderer = new THREE.CanvasRenderer();
            renderer.setPixelRatio( window.devicePixelRatio );
        } else {
            renderer = !isSupportWebgl?new THREE.CanvasRenderer():new THREE.WebGLRenderer({ antialias: false });
            renderer.setPixelRatio( window.devicePixelRatio );
        }

		//create renderer and place in document
        // Antialiasing temporarily disabled to improve performance.
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(window.innerWidth, window.innerHeight);
		if (isSupportWebgl) {
            renderer.domElement.addEventListener('webglcontextlost', function contextLost(event) {
                console.log('lost context', event);
            });
        }
		// renderer.shadowMapEnabled = true;
		// renderer.shadowMapSoft = true;

		//need a scene to put all our objects in
		scene = new THREE.Scene();

		bodyWrapper = new VRObject(scene, require('./objects/empty'), null, {
			name: 'body'
		}).moveTo(0, 1.5, 4);
		body = bodyWrapper.object;

		cameraWrapper = new VRObject(body, function (parent) {
        //    camera = new THREE.OrthographicCamera(
        //            window.innerWidth / - 24, window.innerWidth / 24,window.innerHeight / 24, window.innerHeight / - 24, -310, 100000);
        //    camera.position.x = 0;
        //    camera.position.y = 0;
        //    camera.zoom = 0.4;
		//	camera.position.set(-0.000001, 0.0001, 0.0001);
		//	camera.rotation.set(0, 0, 0);

			//need a camera with which to look at stuff
            // The viewer proportion will be a square not a rect.
			camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, NEAR, FAR);
            camera.setFocalLength(8);
            // camera.zoom = 0.8;
			// camera.position.set(-0.000001, 1, 0.0001);
            // camera.autoBackward = true;
			parent.add(camera);
			return camera;
		})
		// set camera position so that OrbitControls works properly.
			.moveTo(0, 0.0001, 0.0001);

		audioListener = new THREE.AudioListener();
		audioListener.name = 'audio-listener';
		camera.add(audioListener);

		//VRControls point the camera wherever we're looking
		vrControls = new THREE.VRControls(camera);
		vrControls.freeze = !orientationEnabled;

		//render left and right eye
		vrEffect = new THREE.VRStereoEffect(renderer);
		vrEffect.near = NEAR;
		vrEffect.far = FAR;
		vrEffect.addEventListener('fullscreenchange', function (evt) {
			var screen;
			if (isFullscreen()) {
				if (vrMode) {
					//no mouse control
					mouseControls.enabled = false;

					vrControls.freeze = false;
					vrControls.reset();

					screen = window.screen;
					if (screen.lockOrientation) {
						screen.lockOrientation('landscape-primary');
					} else if (screen.mozLockOrientation) {
						screen.mozLockOrientation('landscape-primary');
					} else if (screen.orientation && screen.orientation.lock) {
						screen.orientation.lock('landscape-primary');
					}
				}
			} else {
				VR.exitVR();
			}

			camera.position.set(0, 0.0001, 0.0001);
			camera.rotation.set(0, 0, 0);

			VR.emit('fullscreenchange', evt);
		});
        scene.isWebview = vrEffect.isWebview;

		//report on HMD
		vrControls.addEventListener('devicechange', function () {
			orientationPossible = true;
			if (orientationEnabled === undefined) {
				orientationEnabled = vrControls.mode() === 'deviceorientation';
			}

			vrControls.freeze = !orientationEnabled && !vrMode;

			VR.emit('devicechange', vrControls.mode(), vrEffect.hmd());
		});

		// mouse control in case got no orientation device
        // Re-start autorotate if user has not been controlled.
        var autoRotateTimer = null;
		mouseControls = new THREE.OrbitControls(camera, renderer.domElement);
		mouseControls.target0.set(0, 0.0001, 0.000);
		mouseControls.target.copy(mouseControls.target0);
        mouseControls.enableZoom = true;
        mouseControls.enablePan = true;
        mouseControls.autoRotate = false;
		if (renderMode === MODE_CSS) {
        	mouseControls.autoRotateSpeed = 0.5;
		} else {
        	mouseControls.autoRotateSpeed = 1.0;
		}
        mouseControls.enableDamping = true;
        mouseControls.dampingFactor = 0.55;
        mouseControls.addEventListener('start', function(){
            if (autoRotateTimer) {
                clearTimeout(autoRotateTimer);
            }
            if (orientationEnabled) {
                mouseControls.enabled = false;
                mouseControls.autoRotate = false;
            } else {
                mouseControls.enabled = true;
                mouseControls.autoRotate = false;
            }
        });
        mouseControls.addEventListener('end', function(){
            autoRotateTimer = setTimeout(function(){
                if (orientationEnabled) {
                    mouseControls.enabled = false;
                    mouseControls.autoRotate = false;
                } else {
                    mouseControls.enabled = true;
                    mouseControls.autoRotate = true;
                }
            }, 2000);
        });
        mouseControls.enabled = false;
		mouseControls.update();

		//todo: remove any default lights once other lights are added
        // Will not use this way because memory
		var dLight = new THREE.DirectionalLight(0xffffff, 0.8);
		dLight.name = 'directional-light';
		dLight.position.set(20, 100, 100);

		dLight.castShadow = true;
		dLight.shadowCameraVisible = true;

		dLight.shadowMapWidth = 2048;
		dLight.shadowMapHeight = 2048;

		dLight.shadowCameraLeft = -10;
		dLight.shadowCameraRight = 10;
		dLight.shadowCameraTop = 10;
		dLight.shadowCameraBottom = -10;

		dLight.shadowCameraFar = 150;
		dLight.shadowCameraNear = 100;
		dLight.shadowDarkness = 1;

		scene.add(dLight);

		scene.add(new THREE.AmbientLight(0x444444));

		if (VR) {
			VR.camera = cameraWrapper;
			VR.body = bodyWrapper;
			VR.scene = scene;
			VR.canvas = renderer.domElement;
			VR.renderer = renderer;
			VR.zeroSensor = vrControls.zeroSensor;
		}

		raycaster = new THREE.Raycaster();

		if (document.body) {
			attachCanvas();
		} else {
			window.addEventListener('load', attachCanvas, false);
		}

		VR.canvas.addEventListener('webkitfullscreenerror', fullScreenError, false);
		VR.canvas.addEventListener('fullscreenerror', fullScreenError, false);
	}

	function initRequirements() {
		//load external requirements
		THREE = require('three');
		require('imports?THREE=three!DeviceOrientationControls');
		require('imports?THREE=three!OrbitControls');

		//if (typeof __DEV__ !== 'undefined' && __DEV__) {
			require('imports?THREE=three!AugmentedConsole');
		//}

		THREE.ImageUtils.crossOrigin = '';

		eventEmitter = require('event-emitter');

        //if (!isSupportWebgl) {
			// compatible mode
			// Fixed render in all mobile device
			require('imports?THREE=three!./lib/CSS3DRenderer.js');
            require('imports?THREE=three!./lib/CanvasRenderer.js');
            require('imports?THREE=three!./lib/Projector.js');
          //  return;
        //}

		//my VR stuff. todo: move these to a separate repo or two for easy packaging
		require('imports?THREE=three!./lib/VRStereoEffect');
		require('imports?THREE=three!./lib/VRControls');
	}


	function initialize(renderMode) {
		//todo: set up button/info elements

		initScene(renderMode);

		initShake();

		resize();


		document.addEventListener('visibilitychange', visibilityChange);
		document.addEventListener('mozvisibilitychange', visibilityChange);
		document.addEventListener('msvisibilitychange', visibilityChange);
		document.addEventListener('webkitvisibilitychange', visibilityChange);
	}

	initRequirements();

	module.exports = VR = {
		init: initialize,
		render: render,
		start: start,
		stop: stop,
		resize: resize,
        controls: mouseControls,
        orientationPossible: function () {
            return orientationPossible;
        },

		THREE: THREE,

		materials: materials,

		animate: function (callback) {
			var i;
			if (typeof callback === 'function') {
				i = animationCallbacks.indexOf(callback);
				if (i < 0) {
					animationCallbacks.push(callback);
				}
			}
		},

		end: function (callback) {
			var i;

			if (!callback) {
				animationCallbacks.length = 0;
				return;
			}

			if (typeof callback === 'function') {
				i = animationCallbacks.indexOf(callback);
				if (i >= 0) {
					animationCallbacks.splice(i, 1);
				}
			}
		},

		requestVR: function () {
			//todo: check if it's possible
			if (vrMode || !vrEffect) {
				return;
			}

			vrMode = true;

			//full screen and render two eyes
			//always full screen
			vrEffect.requestFullScreen();
			mouseControls.enabled = false;
		},

		exitVR: function () {
			vrMode = false;
			if (!vrEffect.isWebview() && isFullscreen()) {
				exitFullscreen();
				return;
			}
            vrEffect.exit();

			vrControls.freeze = !orientationEnabled;
			camera.rotation.set(0, 0, 0);
			mouseControls.enabled = true;
		},

		vrMode: function () {
			return vrMode && isFullscreen();
		},

		orientationEnabled: function () {
			return !!orientationEnabled;
		},
		enableOrientation: function () {
			orientationEnabled = true;
			if (!vrMode) {
				vrControls.freeze = false;
			}
			mouseControls.enabled = false;
            mouseControls.autoRotate = false;
		},
		disableOrientation: function () {
			orientationEnabled = false;
			camera.rotation.set(0, 0, 0);
			vrControls.freeze = !vrMode;
			mouseControls.enabled = true;
            mouseControls.autoRotate = true;
		},

		isFullscreen: isFullscreen,
		requestFullscreen: requestFullscreen,
		exitFullscreen: function () {
			if (isFullscreen()) {
				exitFullscreen();
			}
		},

		controlMode: function () {
			return vrControls && vrControls.mode();
		},

		zeroSensor: nop,

		vibrate: navigator.vibrate ? navigator.vibrate.bind(navigator) : nop,

		// Utility
		times: function (n, callback) {
			var i;

			for (i = 0; i < n; i++) {
				callback(i);
			}
		},

		camera: cameraWrapper,
		body: bodyWrapper,
		scene: scene,
		renderer: renderer || null,
		canvas: renderer && renderer.domElement || null,
        isSupportWebgl: isSupportWebgl
	};

	objectMethods.forEach(function (method) {
		var creator = require('./objects/' + method),
			key;

		VR[method] = function (options) {
			var obj = new VRObject(scene, creator, body, options, renderer);
			vrObjects.push(obj);
			if (obj.raycastable) {
				raycastable.push(obj.object);
			}
			return obj;
		};

		VRObject.prototype[method] = function (options) {
			var obj = new VRObject(this.object, creator, body, options, renderer);
			vrObjects.push(obj);
			if (obj.raycastable) {
				raycastable.push(obj.object);
			}
			return obj;
		};

		for (key in creator) {
			if (creator.hasOwnProperty(key) && typeof creator[key] === 'function') {
				VR[method][key] = creator[key];
				VRObject.prototype[method][key] = creator[key];
			}
		}
	});

	eventEmitter(VR);

	Object.defineProperty(VR, 'target', {
		get: function () {
			return target;
		}
	});
    // Compatible in android < 5.0
    // Fix something what VR was undefined.
    window.VR = VR;
}());
