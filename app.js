(() => {
  "use strict";

  const themes = {
    citrus: {
      name: "杏橙",
      code: "CITRUS",
      index: 1,
      colors: ["#ff5b36", "#f6c947", "#ff965e"]
    },
    tide: {
      name: "潮汐",
      code: "TIDE",
      index: 2,
      colors: ["#008e96", "#78dec9", "#36c2b0"]
    },
    iris: {
      name: "鸢尾",
      code: "IRIS",
      index: 3,
      colors: ["#6748ef", "#f273c5", "#9d7bff"]
    },
    moss: {
      name: "苔原",
      code: "MOSS",
      index: 4,
      colors: ["#4c7b50", "#d9b866", "#82a75f"]
    },
    night: {
      name: "午夜",
      code: "NIGHT",
      index: 5,
      colors: ["#6fe7c0", "#8b7cff", "#44b9d8"]
    }
  };

  const body = document.body;
  const root = document.documentElement;
  const canvas = document.querySelector("#paint");
  const ctx = canvas.getContext("2d", { alpha: true });
  const swatches = [...document.querySelectorAll(".swatch")];
  const cards = [...document.querySelectorAll(".link-card")];
  const themeName = document.querySelector("#themeName");
  const themeCode = document.querySelector("#themeCode");
  const readoutCode = document.querySelector("#readoutCode");
  const readoutBar = document.querySelector("#readoutBar");
  const announcement = document.querySelector("#themeAnnouncement");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let activeKey = themes[body.dataset.palette] ? body.dataset.palette : "citrus";
  let palette = themes[activeKey].colors.map(hexToRgb);
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let lastFrame = performance.now();
  let lastTrail = 0;
  let visible = !document.hidden;
  let pointerSeen = false;
  let mouseX = window.innerWidth * .66;
  let mouseY = window.innerHeight * .42;
  let lastX = mouseX;
  let lastY = mouseY;
  let smoothX = mouseX;
  let smoothY = mouseY;

  const dabs = [];
  const ripples = [];
  const ambient = [
    { x: .08, y: .22, r: .31, vx: .000045, vy: .000025, phase: .2 },
    { x: .86, y: .13, r: .24, vx: -.000035, vy: .00003, phase: 1.3 },
    { x: .72, y: .88, r: .34, vx: .00003, vy: -.000036, phase: 2.6 },
    { x: .32, y: .74, r: .22, vx: -.000027, vy: -.00002, phase: 4.1 }
  ];

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const value = Number.parseInt(clean, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function addDab(x, y, force = 1) {
    const angle = Math.atan2(y - lastY, x - lastX) || Math.random() * Math.PI * 2;
    const speed = Math.min(2.4, Math.hypot(x - lastX, y - lastY) * .035);
    const colorIndex = Math.floor(Math.random() * palette.length);
    const life = .82 + Math.random() * .18;
    dabs.push({
      x,
      y,
      vx: Math.cos(angle) * speed * (Math.random() - .35),
      vy: Math.sin(angle) * speed * (Math.random() - .35),
      radius: (17 + Math.random() * 37) * Math.min(1.4, force + .35),
      stretch: 1 + Math.random() * .85,
      angle,
      color: palette[colorIndex],
      life,
      decay: .011 + Math.random() * .014
    });
    lastX = x;
    lastY = y;
  }

  function paintTrail(x, y, force = .9, now = performance.now()) {
    const distance = Math.hypot(x - lastX, y - lastY);
    if (distance < 3 && now - lastTrail < 16) return;
    const amount = distance > 60 ? 4 : distance > 24 ? 3 : distance > 8 ? 2 : 1;
    for (let i = 0; i < amount; i += 1) addDab(x + (Math.random() - .5) * 8, y + (Math.random() - .5) * 8, force);
    lastTrail = now;
  }

  function onPointerMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
    pointerSeen = true;

    const nx = (mouseX / width - .5) * -10;
    const ny = (mouseY / height - .5) * -9;
    root.style.setProperty("--pointer-x", `${nx.toFixed(2)}px`);
    root.style.setProperty("--pointer-y", `${ny.toFixed(2)}px`);

    if (!reducedMotion) paintTrail(mouseX, mouseY, event.pressure || .8);

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
        card.style.setProperty("--mx", `${mouseX - rect.left}px`);
        card.style.setProperty("--my", `${mouseY - rect.top}px`);
      }
    }
  }

  function onPointerDown(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (reducedMotion) return;

    for (let i = 0; i < 15; i += 1) {
      addDab(
        event.clientX + (Math.random() - .5) * 24,
        event.clientY + (Math.random() - .5) * 24,
        1.8
      );
    }

    ripples.push({
      x: event.clientX,
      y: event.clientY,
      radius: 9,
      life: 1,
      color: palette[Math.floor(Math.random() * palette.length)]
    });
  }

  function drawAmbient(time) {
    for (let i = 0; i < ambient.length; i += 1) {
      const orb = ambient[i];
      const x = (orb.x + Math.sin(time * orb.vx + orb.phase) * .04) * width;
      const y = (orb.y + Math.cos(time * orb.vy + orb.phase) * .035) * height;
      const radius = Math.min(width, height) * orb.r;
      const color = palette[i % palette.length];
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, rgba(color, .09));
      gradient.addColorStop(.55, rgba(color, .035));
      gradient.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }

  function drawPointerGlow() {
    if (!pointerSeen) return;
    const color = palette[0];
    const radius = 135 + Math.sin(performance.now() * .0027) * 14;
    const gradient = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, radius);
    gradient.addColorStop(0, rgba(color, .055));
    gradient.addColorStop(.45, rgba(palette[1], .035));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(smoothX - radius, smoothY - radius, radius * 2, radius * 2);
  }

  function drawDabs(delta) {
    for (let i = dabs.length - 1; i >= 0; i -= 1) {
      const dab = dabs[i];
      dab.x += dab.vx * delta;
      dab.y += dab.vy * delta;
      dab.vx *= .986;
      dab.vy *= .986;
      dab.life -= dab.decay * delta;

      if (dab.life <= 0) {
        dabs.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(dab.x, dab.y);
      ctx.rotate(dab.angle);
      ctx.scale(dab.stretch, 1);
      const radius = dab.radius * (1.2 + (1 - dab.life) * 1.4);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, rgba(dab.color, .2 * dab.life));
      gradient.addColorStop(.38, rgba(dab.color, .09 * dab.life));
      gradient.addColorStop(1, rgba(dab.color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRipples(delta) {
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const ripple = ripples[i];
      ripple.radius += delta * 4.8;
      ripple.life -= delta * .024;

      if (ripple.life <= 0) {
        ripples.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(ripple.color, ripple.life * .22);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function animate(now) {
    if (!visible) {
      frame = 0;
      return;
    }

    const delta = Math.min(2.2, (now - lastFrame) / 16.67);
    lastFrame = now;
    ctx.clearRect(0, 0, width, height);

    ctx.globalCompositeOperation = activeKey === "night" ? "screen" : "multiply";
    drawAmbient(now);
    drawPointerGlow();
    drawDabs(delta);
    ctx.globalCompositeOperation = "source-over";
    drawRipples(delta);

    if (pointerSeen) {
      smoothX += (mouseX - smoothX) * .075;
      smoothY += (mouseY - smoothY) * .075;
    }

    frame = requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (frame || reducedMotion) return;
    lastFrame = performance.now();
    frame = requestAnimationFrame(animate);
  }

  function stopAnimation() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function setTheme(key, options = {}) {
    if (!themes[key]) return;
    activeKey = key;
    palette = themes[key].colors.map(hexToRgb);
    body.dataset.palette = key;
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(body).getPropertyValue("--bg").trim();

    for (const swatch of swatches) {
      const selected = swatch.dataset.theme === key;
      swatch.setAttribute("aria-checked", String(selected));
      swatch.tabIndex = selected ? 0 : -1;
    }

    const item = themes[key];
    themeName.textContent = item.name;
    themeCode.textContent = item.code;
    readoutCode.textContent = `${String(item.index).padStart(2, "0")} / ${item.code}`;
    readoutBar.style.width = `${item.index * 20}%`;

    if (!options.silent) {
      try { localStorage.setItem("anyi-palette", key); } catch (_) {}
      announcement.textContent = `已切换到${item.name}调色板`;
      if (!reducedMotion) {
        const centerX = width * .23;
        const centerY = height * .5;
        for (let i = 0; i < 12; i += 1) addDab(centerX + Math.random() * width * .5, centerY + (Math.random() - .5) * height * .48, 1.2);
      }
    }
  }

  function handleKeyboard(event) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

    if (/^[1-5]$/.test(event.key)) {
      const key = Object.keys(themes)[Number(event.key) - 1];
      setTheme(key);
      swatches[Number(event.key) - 1].focus({ preventScroll: true });
    }

    if (event.target.classList.contains("swatch")) {
      const current = swatches.indexOf(event.target);
      if (current < 0) return;
      let next = current;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % swatches.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + swatches.length) % swatches.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = swatches.length - 1;
      if (next !== current || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        swatches[next].focus();
        setTheme(swatches[next].dataset.theme);
      }
    }
  }

  resize();
  let saved = null;
  try { saved = localStorage.getItem("anyi-palette"); } catch (_) {}
  setTheme(themes[saved] ? saved : activeKey, { silent: true });

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("keydown", handleKeyboard);

  for (const swatch of swatches) {
    swatch.addEventListener("click", () => setTheme(swatch.dataset.theme));
  }

  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (visible) startAnimation();
    else stopAnimation();
  });

  if (reducedMotion) {
    drawAmbient(0);
  } else {
    for (let i = 0; i < 9; i += 1) {
      addDab(width * (.08 + Math.random() * .84), height * (.1 + Math.random() * .78), .45);
    }
    startAnimation();
  }
})();
