/*
 * Aqua Dynamics - WebGL Water Physics Application
 * Complete Interactive Experience inspired by Evan Wallace (Figma Co-founder)
 */

// Aqua Dynamics Global Application State
var water;
var cubemap;
var renderer;

  // Camera angles and distance
  var angleX = -25;
  var angleY = -200.5;
  var cameraDist = 4.0;
  var autoOrbit = false;

  // Sphere physics state
  var useSpherePhysics = true;
  var center, oldCenter, velocity, gravity;
  var radius = 0.25;
  var paused = false;
  var wasSubmerged = false;

  // Rain simulator state
  var rainActive = false;
  var rainTimer = null;
  var rainRate = 25; // drops per second

  // Touch & Drag modes
  var mode = -1;
  var MODE_ADD_DROPS = 0;
  var MODE_MOVE_SPHERE = 1;
  var MODE_ORBIT_CAMERA = 2;
  var prevHit, planeNormal, oldX, oldY;
  var dragHistory = [];

  // Performance stats
  var fps = 60;
  var frameCount = 0;
  var lastFpsUpdate = performance.now();

  // Color & Material Presets
  var PRESETS = {
    tropical: {
      above: [0.25, 1.0, 1.25],
      under: [0.4, 0.9, 1.0],
      caustics: 1.2
    },
    deepOcean: {
      above: [0.1, 0.5, 0.95],
      under: [0.05, 0.3, 0.65],
      caustics: 0.85
    },
    emerald: {
      above: [0.2, 0.95, 0.65],
      under: [0.15, 0.75, 0.5],
      caustics: 1.15
    },
    sunset: {
      above: [1.15, 0.65, 0.4],
      under: [0.85, 0.35, 0.25],
      caustics: 1.3
    },
    cyberpunk: {
      above: [0.1, 1.2, 1.1],
      under: [0.75, 0.1, 0.95],
      caustics: 1.5
    }
  };

  var SPHERE_MATERIALS = {
    ceramic: { color: [0.55, 0.55, 0.58], refl: 0.15 },
    chrome: { color: [0.92, 0.94, 0.98], refl: 0.9 },
    gold: { color: [1.0, 0.82, 0.2], refl: 0.75 },
    obsidian: { color: [0.12, 0.13, 0.15], refl: 0.45 },
    ruby: { color: [0.9, 0.2, 0.3], refl: 0.6 }
  };

  function init() {
    if (!window.gl) {
      document.getElementById('loading').innerHTML =
        '<div class="error-box">WebGL initialization failed. Please ensure WebGL and hardware acceleration are enabled in your browser.</div>';
      return;
    }
    gl = window.gl;

    var ratio = window.devicePixelRatio || 1;
    var container = document.getElementById('canvas-container');
    container.appendChild(gl.canvas);
    gl.clearColor(0.02, 0.04, 0.08, 1);

    water = new Water();
    renderer = new Renderer();

    cubemap = new Cubemap({
      xneg: document.getElementById('xneg'),
      xpos: document.getElementById('xpos'),
      yneg: document.getElementById('ypos'),
      ypos: document.getElementById('ypos'),
      zneg: document.getElementById('zneg'),
      zpos: document.getElementById('zpos')
    });

    if (!water.textureA.canDrawTo() || !water.textureB.canDrawTo()) {
      document.getElementById('loading').innerHTML =
        '<div class="error-box">Floating-point texture rendering is required by your GPU but not supported.</div>';
      return;
    }

    center = oldCenter = new GL.Vector(-0.35, -0.7, 0.2);
    velocity = new GL.Vector();
    gravity = new GL.Vector(0, -4, 0);
    radius = 0.25;

    // Seed initial gentle ripples
    for (var i = 0; i < 15; i++) {
      water.addDrop(Math.random() * 2 - 1, Math.random() * 2 - 1, 0.03, (i & 1) ? 0.012 : -0.012);
    }

    // Hide loader
    var loader = document.getElementById('loading');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(function() { loader.style.display = 'none'; }, 400);
    }

    onresize();
    window.addEventListener('resize', onresize);

    setupInteractions();
    setupUI();

    var prevTime = performance.now();
    function animate(currentTime) {
      requestAnimationFrame(animate);
      var delta = (currentTime - prevTime) / 1000;
      prevTime = currentTime;

      // Update FPS
      frameCount++;
      if (currentTime - lastFpsUpdate >= 500) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate));
        var fpsElem = document.getElementById('fps-metric');
        if (fpsElem) fpsElem.textContent = fps + ' FPS';
        frameCount = 0;
        lastFpsUpdate = currentTime;
      }

      if (autoOrbit) {
        angleY += delta * 12.0;
      }

      if (!paused) {
        update(Math.min(delta, 0.06));
        draw();
      }
    }
    requestAnimationFrame(animate);
  }

  function onresize() {
    var ratio = window.devicePixelRatio || 1;
    var width = window.innerWidth;
    var height = window.innerHeight;
    gl.canvas.width = width * ratio;
    gl.canvas.height = height * ratio;
    gl.canvas.style.width = width + 'px';
    gl.canvas.style.height = height + 'px';
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.matrixMode(gl.PROJECTION);
    gl.loadIdentity();
    gl.perspective(45, gl.canvas.width / gl.canvas.height, 0.01, 100);
    gl.matrixMode(gl.MODELVIEW);
    draw();
  }

  function update(seconds) {
    if (seconds > 0.1) return;

    if (mode === MODE_MOVE_SPHERE) {
      velocity = new GL.Vector();
    } else if (useSpherePhysics) {
      // Viscous drag & buoyancy when partially/fully submerged
      var percentUnderWater = Math.max(0, Math.min(1, (radius - center.y) / (2 * radius)));

      // Plunge splash sound trigger when entering water
      var isSubmerged = center.y < radius;
      if (isSubmerged && !wasSubmerged && Math.abs(velocity.y) > 0.8) {
        if (window.waterAudio) window.waterAudio.playSplash(Math.min(1.5, Math.abs(velocity.y) * 0.4));
      }
      wasSubmerged = isSubmerged;

      velocity = velocity.add(gravity.multiply(seconds - 1.15 * seconds * percentUnderWater));
      velocity = velocity.subtract(velocity.unit().multiply(percentUnderWater * seconds * velocity.dot(velocity) * 1.2));
      center = center.add(velocity.multiply(seconds));

      // Bounce off pool bottom
      if (center.y < radius - 1) {
        center.y = radius - 1;
        velocity.y = Math.abs(velocity.y) * 0.65;
        velocity.x *= 0.85;
        velocity.z *= 0.85;
      }

      // Walls bounce
      var bound = 1 - radius;
      if (center.x < -bound) { center.x = -bound; velocity.x = Math.abs(velocity.x) * 0.6; }
      if (center.x > bound) { center.x = bound; velocity.x = -Math.abs(velocity.x) * 0.6; }
      if (center.z < -bound) { center.z = -bound; velocity.z = Math.abs(velocity.z) * 0.6; }
      if (center.z > bound) { center.z = bound; velocity.z = -Math.abs(velocity.z) * 0.6; }
    }

    // Water displacement by sphere
    water.moveSphere(oldCenter, center, radius);
    oldCenter = center;

    // Simulation steps
    water.stepSimulation();
    water.stepSimulation();
    water.updateNormals();
    renderer.updateCaustics(water);
  }

  function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.loadIdentity();
    gl.translate(0, 0, -cameraDist);
    gl.rotate(-angleX, 1, 0, 0);
    gl.rotate(-angleY, 0, 1, 0);
    gl.translate(0, 0.5, 0);

    gl.enable(gl.DEPTH_TEST);
    renderer.sphereCenter = center;
    renderer.sphereRadius = radius;
    renderer.renderCube();
    renderer.renderWater(water, cubemap);
    renderer.renderSphere();
    gl.disable(gl.DEPTH_TEST);
  }

  // Interaction handlers
  function startDrag(x, y, button) {
    oldX = x;
    oldY = y;
    dragHistory = [{ x: x, y: y, time: performance.now() }];
    var ratio = window.devicePixelRatio || 1;
    var tracer = new GL.Raytracer();
    var ray = tracer.getRayForPixel(x * ratio, y * ratio);
    var pointOnPlane = tracer.eye.add(ray.multiply(-tracer.eye.y / ray.y));
    var sphereHitTest = GL.Raytracer.hitTestSphere(tracer.eye, ray, center, radius);

    if (button === 2) {
      mode = MODE_ORBIT_CAMERA;
    } else if (sphereHitTest) {
      mode = MODE_MOVE_SPHERE;
      prevHit = sphereHitTest.hit;
      planeNormal = tracer.getRayForPixel(gl.canvas.width / 2, gl.canvas.height / 2).negative();
    } else if (Math.abs(pointOnPlane.x) < 1 && Math.abs(pointOnPlane.z) < 1) {
      mode = MODE_ADD_DROPS;
      duringDrag(x, y);
    } else {
      mode = MODE_ORBIT_CAMERA;
    }
  }

  function duringDrag(x, y) {
    var ratio = window.devicePixelRatio || 1;
    var now = performance.now();
    dragHistory.push({ x: x, y: y, time: now });
    if (dragHistory.length > 5) dragHistory.shift();

    switch (mode) {
      case MODE_ADD_DROPS: {
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);
        var pointOnPlane = tracer.eye.add(ray.multiply(-tracer.eye.y / ray.y));
        water.addDrop(pointOnPlane.x, pointOnPlane.z, 0.035, 0.015);
        if (window.waterAudio) window.waterAudio.playDrop(0.4);
        if (paused) {
          water.updateNormals();
          renderer.updateCaustics(water);
        }
        break;
      }
      case MODE_MOVE_SPHERE: {
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);
        var t = -planeNormal.dot(tracer.eye.subtract(prevHit)) / planeNormal.dot(ray);
        var nextHit = tracer.eye.add(ray.multiply(t));
        center = center.add(nextHit.subtract(prevHit));
        center.x = Math.max(radius - 1, Math.min(1 - radius, center.x));
        center.y = Math.max(radius - 1, Math.min(3.5, center.y));
        center.z = Math.max(radius - 1, Math.min(1 - radius, center.z));
        prevHit = nextHit;
        if (paused) renderer.updateCaustics(water);
        break;
      }
      case MODE_ORBIT_CAMERA: {
        angleY -= (x - oldX) * 0.7;
        angleX -= (y - oldY) * 0.7;
        angleX = Math.max(-89.9, Math.min(89.9, angleX));
        break;
      }
    }
    oldX = x;
    oldY = y;
    if (paused) draw();
  }

  function stopDrag() {
    if (mode === MODE_MOVE_SPHERE && dragHistory.length >= 2 && useSpherePhysics) {
      // Calculate throw inertia velocity
      var first = dragHistory[0];
      var last = dragHistory[dragHistory.length - 1];
      var dt = (last.time - first.time) / 1000;
      if (dt > 0.01 && dt < 0.25) {
        var tracer = new GL.Raytracer();
        var ratio = window.devicePixelRatio || 1;
        var r1 = tracer.getRayForPixel(first.x * ratio, first.y * ratio);
        var r2 = tracer.getRayForPixel(last.x * ratio, last.y * ratio);
        var p1 = tracer.eye.add(r1.multiply(4.0));
        var p2 = tracer.eye.add(r2.multiply(4.0));
        var v = p2.subtract(p1).divide(dt * 1.5);
        velocity = new GL.Vector(
          Math.max(-5, Math.min(5, v.x)),
          Math.max(-5, Math.min(5, v.y)),
          Math.max(-5, Math.min(5, v.z))
        );
      }
    }
    mode = -1;
  }

  function isInteractiveElement(target) {
    return target.closest('.ui-panel, .floating-bar, .modal-backdrop, button, input, a, select');
  }

  function setupInteractions() {
    window.addEventListener('mousedown', function(e) {
      if (isInteractiveElement(e.target)) return;
      startDrag(e.pageX, e.pageY, e.button);
    });

    window.addEventListener('mousemove', function(e) {
      if (mode !== -1) duringDrag(e.pageX, e.pageY);
    });

    window.addEventListener('mouseup', function() {
      stopDrag();
    });

    window.addEventListener('contextmenu', function(e) {
      if (!isInteractiveElement(e.target)) e.preventDefault();
    });

    // Zoom via wheel
    window.addEventListener('wheel', function(e) {
      if (isInteractiveElement(e.target)) return;
      e.preventDefault();
      cameraDist += e.deltaY * 0.0035;
      cameraDist = Math.max(2.0, Math.min(7.5, cameraDist));
      if (paused) draw();
    }, { passive: false });

    // Touch events for mobile
    window.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1 && !isInteractiveElement(e.target)) {
        startDrag(e.touches[0].pageX, e.touches[0].pageY, 0);
      }
    });

    window.addEventListener('touchmove', function(e) {
      if (e.touches.length === 1 && mode !== -1) {
        duringDrag(e.touches[0].pageX, e.touches[0].pageY);
      }
    });

    window.addEventListener('touchend', function() {
      stopDrag();
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT') return;
      var key = e.key.toUpperCase();
      if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
      } else if (key === 'G') {
        toggleGravity();
      } else if (key === 'L') {
        alignSunWithCamera();
      } else if (key === 'R') {
        toggleRain();
      } else if (key === 'C') {
        clearWater();
      } else if (key === 'Z') {
        toggleZenMode();
      }
    });
  }

  function togglePause() {
    paused = !paused;
    var btn = document.getElementById('btn-pause');
    if (btn) {
      btn.innerHTML = paused ? '<span class="icon">▶</span> Resume' : '<span class="icon">⏸</span> Pause';
      btn.classList.toggle('active', paused);
    }
  }

  function toggleGravity() {
    useSpherePhysics = !useSpherePhysics;
    var btn = document.getElementById('btn-gravity');
    if (btn) {
      btn.classList.toggle('active', useSpherePhysics);
      btn.setAttribute('aria-pressed', useSpherePhysics);
    }
  }

  function alignSunWithCamera() {
    renderer.lightDir = GL.Vector.fromAngles((90 - angleY) * Math.PI / 180, -angleX * Math.PI / 180);
    if (paused) {
      renderer.updateCaustics(water);
      draw();
    }
    // Update sun slider labels if open
    updateSunSliders();
  }

  function toggleRain() {
    rainActive = !rainActive;
    var btn = document.getElementById('btn-rain');
    if (btn) btn.classList.toggle('active', rainActive);

    if (rainActive) {
      startRain();
    } else {
      if (rainTimer) clearInterval(rainTimer);
      rainTimer = null;
    }
  }

  function startRain() {
    if (rainTimer) clearInterval(rainTimer);
    rainTimer = setInterval(function() {
      if (paused) return;
      var rx = (Math.random() * 1.8) - 0.9;
      var rz = (Math.random() * 1.8) - 0.9;
      var strength = 0.008 + Math.random() * 0.012;
      water.addDrop(rx, rz, 0.025, strength);
      if (window.waterAudio && Math.random() < 0.4) {
        window.waterAudio.playDrop(strength * 25);
      }
    }, 1000 / rainRate);
  }

  function clearWater() {
    water.clear();
    water.updateNormals();
    renderer.updateCaustics(water);
    if (paused) draw();
  }

  function triggerTsunami() {
    water.addTsunami(0.045);
    if (window.waterAudio) window.waterAudio.playSplash(1.2);
    if (paused) {
      water.updateNormals();
      renderer.updateCaustics(water);
      draw();
    }
  }

  function dropSphereFromSky() {
    center = new GL.Vector((Math.random() - 0.5) * 0.8, 1.6, (Math.random() - 0.5) * 0.8);
    velocity = new GL.Vector(0, -3.5, 0);
    useSpherePhysics = true;
    var gravBtn = document.getElementById('btn-gravity');
    if (gravBtn) gravBtn.classList.add('active');
    if (paused) draw();
  }

  function toggleZenMode() {
    document.body.classList.toggle('zen-mode');
  }

  function setWaterPreset(presetName) {
    var p = PRESETS[presetName];
    if (!p) return;
    renderer.abovewaterColor = new GL.Vector(p.above[0], p.above[1], p.above[2]);
    renderer.underwaterColor = new GL.Vector(p.under[0], p.under[1], p.under[2]);
    renderer.causticIntensity = p.caustics;
    renderer.updateCaustics(water);
    if (paused) draw();
  }

  function setSphereMaterial(matName) {
    var m = SPHERE_MATERIALS[matName];
    if (!m) return;
    renderer.sphereColor = new GL.Vector(m.color[0], m.color[1], m.color[2]);
    renderer.sphereReflectivity = m.refl;
    if (paused) draw();
  }

  function updateSunSliders() {
    // compute azimuth and elevation from lightDir
    var lx = renderer.lightDir.x;
    var ly = renderer.lightDir.y;
    var lz = renderer.lightDir.z;
    var elev = Math.round(Math.asin(ly) * 180 / Math.PI);
    var azim = Math.round(Math.atan2(lx, -lz) * 180 / Math.PI);
    if (azim < 0) azim += 360;

    var azimSlider = document.getElementById('slider-sun-azimuth');
    var elevSlider = document.getElementById('slider-sun-elevation');
    if (azimSlider) azimSlider.value = azim;
    if (elevSlider) elevSlider.value = elev;
  }

  function setupUI() {
    // Top Bar Actions
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-gravity').addEventListener('click', toggleGravity);
    document.getElementById('btn-rain').addEventListener('click', toggleRain);
    document.getElementById('btn-tsunami').addEventListener('click', triggerTsunami);
    document.getElementById('btn-drop-ball').addEventListener('click', dropSphereFromSky);
    document.getElementById('btn-calm').addEventListener('click', clearWater);
    document.getElementById('btn-zen').addEventListener('click', toggleZenMode);
    document.getElementById('btn-exit-zen').addEventListener('click', toggleZenMode);

    // Audio Mute Toggle
    var audioBtn = document.getElementById('btn-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', function() {
        if (!window.waterAudio) return;
        var on = window.waterAudio.toggle();
        audioBtn.classList.toggle('active', on);
        audioBtn.innerHTML = on ? '<span class="icon">🔊</span>' : '<span class="icon">🔇</span>';
      });
    }

    // Auto-orbit toggle
    var orbitBtn = document.getElementById('btn-orbit');
    if (orbitBtn) {
      orbitBtn.addEventListener('click', function() {
        autoOrbit = !autoOrbit;
        orbitBtn.classList.toggle('active', autoOrbit);
      });
    }

    // Fullscreen toggle
    var fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', function() {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(function() {});
        } else {
          document.exitFullscreen().catch(function() {});
        }
      });
    }

    // Sun to camera button
    var sunBtn = document.getElementById('btn-sun-align');
    if (sunBtn) {
      sunBtn.addEventListener('click', alignSunWithCamera);
    }

    // Presets
    document.querySelectorAll('.preset-pill').forEach(function(el) {
      el.addEventListener('click', function() {
        document.querySelectorAll('.preset-pill').forEach(function(b) { b.classList.remove('active'); });
        el.classList.add('active');
        setWaterPreset(el.dataset.preset);
      });
    });

    // Sphere materials
    document.querySelectorAll('.mat-pill').forEach(function(el) {
      el.addEventListener('click', function() {
        document.querySelectorAll('.mat-pill').forEach(function(b) { b.classList.remove('active'); });
        el.classList.add('active');
        setSphereMaterial(el.dataset.mat);
      });
    });

    // Sliders
    var dampingSlider = document.getElementById('slider-damping');
    if (dampingSlider) {
      dampingSlider.addEventListener('input', function() {
        water.damping = parseFloat(this.value);
        document.getElementById('val-damping').textContent = this.value;
      });
    }

    var radiusSlider = document.getElementById('slider-radius');
    if (radiusSlider) {
      radiusSlider.addEventListener('input', function() {
        radius = parseFloat(this.value);
        document.getElementById('val-radius').textContent = this.value;
        if (paused) draw();
      });
    }

    var causticSlider = document.getElementById('slider-caustics');
    if (causticSlider) {
      causticSlider.addEventListener('input', function() {
        renderer.causticIntensity = parseFloat(this.value);
        document.getElementById('val-caustics').textContent = this.value + 'x';
        renderer.updateCaustics(water);
        if (paused) draw();
      });
    }

    var sunAzimuth = document.getElementById('slider-sun-azimuth');
    var sunElevation = document.getElementById('slider-sun-elevation');
    function updateSunFromSliders() {
      var az = parseFloat(sunAzimuth.value) * Math.PI / 180;
      var el = parseFloat(sunElevation.value) * Math.PI / 180;
      var y = Math.sin(el);
      var r = Math.cos(el);
      var x = Math.sin(az) * r;
      var z = -Math.cos(az) * r;
      renderer.lightDir = new GL.Vector(x, y, z).unit();
      renderer.updateCaustics(water);
      if (paused) draw();
    }
    if (sunAzimuth && sunElevation) {
      sunAzimuth.addEventListener('input', updateSunFromSliders);
      sunElevation.addEventListener('input', updateSunFromSliders);
    }

    // Modal Tech Specs Toggle
    var techModal = document.getElementById('tech-modal');
    var openTechBtn = document.getElementById('btn-open-tech');
    var closeTechBtn = document.getElementById('btn-close-tech');
    if (openTechBtn && techModal) {
      openTechBtn.addEventListener('click', function() {
        techModal.classList.add('open');
      });
    }
    if (closeTechBtn && techModal) {
      closeTechBtn.addEventListener('click', function() {
        techModal.classList.remove('open');
      });
    }
    if (techModal) {
      techModal.addEventListener('click', function(e) {
        if (e.target === techModal) techModal.classList.remove('open');
      });
    }

    // Tab switcher in Studio Drawer
    var tabBtns = document.querySelectorAll('.studio-tab-btn');
    var tabPanes = document.querySelectorAll('.studio-tab-pane');
    tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        tabBtns.forEach(function(b) { b.classList.remove('active'); });
        tabPanes.forEach(function(p) { p.classList.remove('active'); });
        btn.classList.add('active');
        var targetPane = document.getElementById('tab-' + btn.dataset.tab);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // Collapse / Expand studio drawer
    var toggleDrawerBtn = document.getElementById('btn-toggle-drawer');
    var studioDrawer = document.getElementById('studio-drawer');
    if (toggleDrawerBtn && studioDrawer) {
      toggleDrawerBtn.addEventListener('click', function() {
        studioDrawer.classList.toggle('collapsed');
        var isCollapsed = studioDrawer.classList.contains('collapsed');
        toggleDrawerBtn.innerHTML = isCollapsed
          ? '<span class="icon">⚙️</span> Controls'
          : '<span class="icon">✕</span> Minimize';
      });
    }
  }

  window.addEventListener('load', init);
