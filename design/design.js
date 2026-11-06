/* Design page: the Lagunita tester. */
(function () {
  function $(id) { return document.getElementById(id); }
  var sample = $('t-sample');
  if (!sample) return;
  var size = $('t-size'), wght = $('t-wght'), opsz = $('t-opsz');
  var style = 'normal';
  // a phone starts smaller, so the sample isn't a tower of single words
  size.value = Math.round(Math.max(44, Math.min(132, window.innerWidth * 0.11)));

  function paint() {
    var s = sample.style;
    s.fontSize = size.value + 'px';
    s.fontWeight = wght.value;
    s.fontStyle = style;
    // hold the optical size: Safari needs optical sizing off to listen
    s.fontOpticalSizing = 'none';
    s.fontVariationSettings = '"opsz" ' + opsz.value;
  }
  [size, wght, opsz].forEach(function (i) { i.addEventListener('input', paint); });

  function group(attr, apply) {
    var all = document.querySelectorAll('.dg-tester [' + attr + ']');
    all.forEach(function (b) {
      b.addEventListener('click', function () {
        apply(b.getAttribute(attr));
        all.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        paint();
      });
    });
  }
  group('data-style', function (v) { style = v; });
  group('data-align', function (v) { sample.style.textAlign = v; });

  // type "stanford" and the sample takes on the wordmark's cardinal
  sample.addEventListener('input', function () {
    sample.classList.toggle('is-cardinal', /stanford/i.test(sample.textContent));
  });

  // paste as plain text, so the sample keeps its face
  sample.addEventListener('paste', function (e) {
    var text = (e.clipboardData || window.clipboardData).getData('text');
    if (text == null) return;
    e.preventDefault();
    document.execCommand('insertText', false, text);
  });

  paint();
})();
