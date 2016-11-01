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
    
    var texturePlaceholder = document.createElement( 'canvas' );
    texturePlaceholder.width = 64;
    texturePlaceholder.height = 64;
    var context = texturePlaceholder.getContext( '2d' );
    context.fillStyle = 'rgb( 200, 200, 200 )';
    context.fillRect( 0, 0, texturePlaceholder.width, texturePlaceholder.height );
	var STR_CHILDEN_NAME = 'obj3DElement';

    function loadTexture( path, _parent ) {
        var texture = new THREE.Texture( texturePlaceholder );
        var material = new THREE.MeshBasicMaterial( { map: texture, overdraw: 0.5 } );
        var image = new Image();
        image.onload = function () {
            texture.image = this;
            texture.needsUpdate = true;
            _parent.dispatchEvent({
                type: 'img-loaded'
            });
        };
        image.src = path;
        return material;
    }

	return function panorama(parent, options, renderer, root) {
        var src,
            preview,
            cubeSrc = {};
		var self = this;
		var material,
			mesh,
            pretex,
            mapKey,
			tex;

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
        mapKey = src;
        if (!isSupportWebgl) {
            mapKey = cubeSrc.left;
        }
        if (mapRender[mapKey]) {
            // Remove all mesh object if scene contains them.
            // Optimezei and Reduce Memory Usage for Panorama Model.
            for (var key in mapRender) {
                if(mapRender.hasOwnProperty(key)) {
                    while (parent.getObjectByName(key)) {
                        parent.remove(parent.getObjectByName(key));
                    }
                }
            }
            parent.add(mapRender[mapKey]);
            parent.dispatchEvent({
                type: 'img-loaded'
            });
            return mapRender[mapKey];
        }
		if (renderer instanceof THREE.CSS3DRenderer) {
            var tmpStatus = false;
            if (root.orientationEnabled()) {
                tmpStatus = true;
                root.disableOrientation();
            }
            var lastCube = parent.getObjectByName('cube');
            if (lastCube) {
                for ( var i = 0; i < 6; i ++ ) {
                    if (lastCube.getObjectByName(STR_CHILDEN_NAME + i)) {
                        lastCube.remove(lastCube.getObjectByName(STR_CHILDEN_NAME + i));
                    }
                }
                // Force delete last image element.
                // O(6)
                for ( var i = 0; i < 6; i ++ ) {
                    var eleImg = document.getElementById(STR_CHILDEN_NAME + i); 
                    if (eleImg) {
                        eleImg.parentNode.removeChild(eleImg);
                    }
                }
                parent.remove(lastCube);
            }

			var cube = new THREE.Object3D();
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
                element.id = STR_CHILDEN_NAME + i;
                element.onload = callbackOnload;
                var object = new THREE.CSS3DObject( element );
                object.name = STR_CHILDEN_NAME + i;
                object.position.fromArray( side.position );
                object.rotation.fromArray( side.rotation );
                cube.add( object );
            }
			cube.name = 'cube';
            // This is very suck to fix something what change the provide has been blink.
            if (tmpStatus) {
                root.enableOrientation();
            }
            return cube;

		}
        if (!isSupportWebgl) {
            var arrMaterial = [
                loadTexture( cubeSrc.right, parent ), // right
                loadTexture( cubeSrc.left, parent ), // left
                loadTexture( cubeSrc.top, parent ), // top
                loadTexture( cubeSrc.down, parent ), // bottom
                loadTexture( cubeSrc.front, parent ), // front
                loadTexture( cubeSrc.back, parent ) // back
            ];

            mesh = new THREE.Mesh( new THREE.BoxGeometry( 60, 60, 60, 20, 20, 20 ), new THREE.MultiMaterial( arrMaterial ) );
            mesh.scale.x = - 1;
            // The primy name use one of array.
            mesh.name = mapKey;
            // Fisheye
            // for ( var i = 0, l = mesh.geometry.vertices.length; i < l; i ++ ) {
            //     var vertex = mesh.geometry.vertices[ i ];
            //     vertex.normalize();
            //     vertex.multiplyScalar( 550 );
            // }
            mapRender[mapKey] = mesh;
            parent.add( mesh );
            return mesh;
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
