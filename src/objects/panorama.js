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
	var materials = require('../materials'),
		THREE = require('three'),
            // geometry = new THREE.BoxGeometry(60, 60, 60);
            // geometry = new THREE.SphereGeometry(100, 60, 60);
        geometry = new THREE.SphereGeometry(5000, 60, 60,
            p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
        geometry.applyMatrix(new THREE.Matrix4().makeScale(-1, 1, 1));
        geometry.applyMatrix(new THREE.Matrix4().makeRotationY(- Math.PI / 2));

	return function panorama(parent, options) {
		var material,
			mesh,
			src,
			tex,
			self = this;

		if (typeof options === 'string') {
			src = options;
		} else if (options) {
			src = options.src;
		}

		if (src) {
			tex = materials.imageTexture(src, THREE.UVMapping, function () {
				self.emit('loaded');
			});
		}

        var uvs = geometry.faceVertexUvs[0];
        for (var i = 0; i < uvs.length; i ++) {
          for (var j = 0; j < 3; j ++) {
            uvs[i][j].x *= p.scaleX;
            uvs[i][j].x += p.offsetX;
            uvs[i][j].y *= p.scaleY;
            uvs[i][j].y += p.offsetY;
          }
        }
		material = new THREE.MeshBasicMaterial({
			transparent: true,
			map: tex
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

		mesh.name = 'panorama';

		parent.add(mesh);

		this.raycastable = false;

		return mesh;
	};
}());
