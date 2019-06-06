var $ = (s, d = document) => Array.from(d.querySelectorAll(s));
$.one = (s, d = document) => d.querySelector(s);

var clockTime = $.one(".clock .time");
var clockDate = $.one(".clock .date");

var tick = function() {
  var now = new Date();
  var hours = now.getHours();
  var minutes = now.getMinutes();
  var seconds = now.getSeconds();

  if (hours > 12) hours -= 12;
  if (hours == 0) hours = 12;
  seconds = (seconds + "").padStart(2, "0");
  minutes = (minutes + "").padStart(2, "0");

  clockTime.innerHTML = `${hours}:${minutes}:${seconds}`;

  var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var day = days[now.getDay()];
  var month = months[now.getMonth()];

  clockDate.innerHTML = `${day}, ${month} ${now.getDate()}`;
}

setInterval(tick, 1000);
tick();

// add top sites list

browser.topSites.get({ includeFavicon: true, limit: 24 }).then(function(sites) {
  $.one(".top-sites").innerHTML = sites.slice(0, 18).map(s => `
<li>
  <a href="${s.url}">
    <img
      src="${s.favicon}"
      class="icon"
      alt="${s.title.slice(0, 1).toUpperCase()}"
      style="background-color: #${s.title.replace(/[^0-9a-f]/g, "").padEnd(6, "0")}">
    <span class="title">${new URL(s.url).host.replace(/www\./, "")}</a>
  </a>
  `).join("");
});

// Shadertoy code

var canvas = document.querySelector(".background");
var gl = canvas.getContext("webgl", { antialias: true });
var editorPanel = $.one(".editor");
var textarea = $.one(".editor textarea");
var editor;
var errorDisplay = $.one(".editor .error");
var showEditorButton = $.one(".show-editor");

var vertex = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertex, `
attribute vec2 coord;
void main() {
  gl_Position = vec4(coord, 0.0, 1.0);
}
`);
gl.compileShader(vertex);
  
var compile = function() {
  var fragment = gl.createShader(gl.FRAGMENT_SHADER);
  var fragSource = editor ? editor.getValue() : textarea.value;
  gl.shaderSource(fragment, fragSource);
  gl.compileShader(fragment);

  var error = gl.getShaderInfoLog(fragment);
  if (error) {
    errorDisplay.classList.add("show");
    errorDisplay.innerHTML = error;
    return;
  }
  errorDisplay.classList.remove("show");
  localStorage.fragment = fragSource;

  var program = gl.createProgram();
  gl.attachShader(program, fragment);
  gl.attachShader(program, vertex);
  gl.linkProgram(program);
  gl.useProgram(program);
  
  // attributes and uniforms
  gl.program = program;
  gl.attributes = {
    coord: 0
  };
  for (var a in gl.attributes) gl.attributes[a] = gl.getAttribLocation(program, a);
  gl.uniforms = {
    u_time: 0,
    u_resolution: 0
  };
  for (var u in gl.uniforms) gl.uniforms[u] = gl.getUniformLocation(program, u);
};

var polys = [
  -1, 1,
  1, 1,
  1, -1,
  -1, 1,
  1, -1,
  -1, -1
];
var buffer = gl.createBuffer();

var frameCounter = 0;
var render = function(t) {
  frameCounter++;
  // throttle to rendering at 30fps for battery life
  if (!(frameCounter % 2)) {
    gl.enableVertexAttribArray(gl.uniforms.coords);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(polys), gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.uniforms.coords, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gl.uniforms.u_time, t + 12581372.5324);
    canvas.width = canvas.clientWidth * .75;
    canvas.height = canvas.clientHeight * .75;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(gl.uniforms.u_resolution, canvas.width, canvas.height);
    gl.clearColor(0, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, polys.length / 2);
  }
  requestAnimationFrame(render);
}

var debounce = function(fn, delay = 1000) {
  var timeout = null;
  return function() {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(fn, delay);
  }
};

var debouncedCompile = debounce(compile);

var getDefaultFragment = async function() {
  var response = await fetch("defaultFragment.glsl");
  var body = await response.text();
  return body;
};

var init = async function() {
  var fragStored = localStorage.fragment;
  textarea.value = fragStored || await getDefaultFragment();
  compile();
  render();

  $.one(".controls .reset").addEventListener("click", async function() {
    var fragDefault = await getDefaultFragment();
    if (editor) {
      editor.setValue(fragDefault);
    } else {
      textarea.value = fragDefault;
    }
    compile();
  })
};

var loadScript = function(url) {
  return new Promise(ok => {
    var script = document.createElement("script");
    script.src = url;
    script.onload = ok;
    document.head.appendChild(script);
  });
};

init();

showEditorButton.addEventListener("click", async function() {
  if (!editor) {
    await loadScript("codemirror.js");
    await loadScript("clike.js");
    editor = CodeMirror.fromTextArea(textarea, {
      theme: "material",
      mode: "clike",
      lineNumbers: true
    });
    editor.on("change", debouncedCompile);
  }
  editorPanel.classList.toggle("show");
});