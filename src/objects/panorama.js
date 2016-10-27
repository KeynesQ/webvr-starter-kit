module.exports = (function () {
	'use strict';

    var p = {};
        p.scaleX = p.scaleX || 1;
        p.scaleY = p.scaleY || 1;
        p.offsetX = p.offsetX || 0;
        p.offsetY = p.offsetY || 0;
        p.phiStart = p.phiStart || 0;
        p.phiLength = p.phiLength || Math.PI * 2;
        p.thetaStart = p.thetaStart || 0;
        p.thetaLength = p.thetaLength || Math.PI;
    // Reduce ptr.
    var isSupportWebgl = Boolean(window.isSupportWebgl);
	var materials = require('../materials'),
		THREE = require('three'),
        // geometry = new THREE.BoxGeometry(15, 15, 15, 10, 10, 10);
            // geometry = new THREE.SphereGeometry(100, 60, 60);
        // geometry = new THREE.SphereGeometry(60, 100, 100,
        geometry = new THREE.SphereGeometry(16, 32, 32, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
        geometry.applyMatrix(new THREE.Matrix4().makeScale(-2, 2, 2.3));
        geometry.applyMatrix(new THREE.Matrix4().makeRotationY(- Math.PI / 3));
    // Will not render panorama if already contains the key.
    var mapRender = {};
    var isListener = false;
    // Will use css3drenderer if not support webgl.
    var cube = new THREE.Object3D();
    var STR_CHILDEN_NAME = 'obj3DElement';

	return function panorama(parent, options) {
        var src,
            preview,
            cubeSrc = {};
		var self = this;

		if (typeof options === 'string') {
			src = options;
		} else if (options) {
			src = options.src;
            preview = options.preview;
            if (options.left) {
                cubeSrc.left = options.left;
                cubeSrc.right = options.right;
                cubeSrc.down = options.down;
                cubeSrc.top = options.top;
                cubeSrc.front = options.front;
                cubeSrc.back = options.back;
            }
		}
        // CSS rendering.
        if (!isSupportWebgl) {
            var sides = [
                {
                    url: cubeSrc.right,
                    position: [ -512, 0, 0 ],
                    rotation: [ 0, Math.PI / 2, 0 ]
                },
                {
                    url: cubeSrc.left,
                    position: [ 512, 0, 0 ],
                    rotation: [ 0, -Math.PI / 2, 0 ]
                },
                {
                    url: cubeSrc.top,
                    position: [ 0,  512, 0 ],
                    rotation: [ Math.PI / 2, 0, Math.PI ]
                },
                {
                    url: cubeSrc.down,
                    position: [ 0, -512, 0 ],
                    rotation: [ - Math.PI / 2, 0, Math.PI ]
                },
                {
                    url: cubeSrc.front,
                    position: [ 0, 0,  512 ],
                    rotation: [ 0, Math.PI, 0 ]
                },
                {
                    url: cubeSrc.back,
                    position: [ 0, 0, -512 ],
                    rotation: [ 0, 0, 0 ]
                }
            ];
            // Remove children from cube;
            for ( var i = 0; i < sides.length; i ++ ) {
                if (cube.getObjectByName(STR_CHILDEN_NAME + i)) {
                    cube.remove(cube.getObjectByName(STR_CHILDEN_NAME + i));
                }
            }
            parent.remove(cube);
            parent.add(cube);
            var callbackOnload = function () {
                // Notify outside to do something when image has been loaded.
                parent.dispatchEvent({
                    type: 'img-loaded'
                });
            };
            for ( var i = 0; i < sides.length; i ++ ) {
                var side = sides[ i ];
                var element = document.createElement( 'img' );
                element.width = 1026; // 2 pixels extra to close the gap.
                element.src = side.url;
                element.onload = callbackOnload;
                var object = new THREE.CSS3DObject( element );
                object.name = STR_CHILDEN_NAME + i;
                object.position.fromArray( side.position );
                object.rotation.fromArray( side.rotation );
                cube.add( object );
            }
            return cube;
        }

		var material,
			mesh,
            pretex,
			tex;
        if (mapRender[src]) {
            // Remove all mesh object if scene contains them.
            // Optimezei and Reduce Memory Usage for Panorama Model.
            for (var key in mapRender) {
                if(mapRender.hasOwnProperty(key)) {
                    while (parent.getObjectByName(key)) {
                        parent.remove(parent.getObjectByName(key));
                    }
                }
            }
            parent.add(mapRender[src]);
            parent.dispatchEvent({
                type: 'img-loaded'
            });
            return mapRender[src];
        }

		if (preview) {
			pretex = materials.imageTexture(preview, THREE.UVMapping, function () {
			});
		}

		if (src) {
            if (!isListener) {
                parent.addEventListener('loaded', function (event) {
                    var data = event.data;
                    while (parent.getObjectByName('preview')) {
                        parent.remove(parent.getObjectByName('preview'));
                    }

                    material = new THREE.MeshBasicMaterial({
                        map: data.tex
                    });
                    mesh = new THREE.Mesh(geometry, material);
                    mapRender[data.src] = mesh;

                    mesh.name = src;

                    parent.add(mesh);
                    parent.dispatchEvent({
                        type: 'img-loaded'
                    });
                });
                isListener = true;
            }
			tex = materials.imageTexture(src, THREE.UVMapping, function () {
                parent.dispatchEvent({
                    type: 'loaded',
                    data: {
                        src: src,
                        tex: tex
                    }
                });
				self.emit('loaded');
			});
		}

		material = new THREE.MeshBasicMaterial({
			// transparent: true,
			// envMap: tex,
			map: pretex
            // side: THREE.DoubleSide,
            // debug
            // wireframe: true,
            // depthWrite: false
            // envMap:cubemap
		});

		mesh = new THREE.Mesh(geometry, material);

		if (options && options.stereo) {
			if (options.stereo === 'vertical') {
				tex.repeat.y = 0.5;
			} else {
				tex.repeat.x = 0.5;
			}
			mesh.userData.stereo = options.stereo;
		}

        mesh.name = 'preview';

        parent.add(mesh);

		this.raycastable = false;

		return mesh;
	};
}());
