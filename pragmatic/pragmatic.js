(function () {
    // Code line numbers
    document.querySelectorAll('.atelier pre').forEach(function (pre) {
        pre.innerHTML = pre.innerHTML.split('\n').map(function (line) {
            return '<span class="code-line">' + (line === '' ? '&nbsp;' : line) + '</span>';
        }).join('');
    });

    // Language tabs
    document.querySelectorAll('.lang-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            var lang = tab.dataset.lang;
            document.querySelectorAll('.lang-tab').forEach(function (t) {
                t.classList.toggle('active', t === tab);
            });
            document.querySelectorAll('.code-snippet').forEach(function (s) {
                s.classList.toggle('active', s.dataset.lang === lang);
            });
        });
    });

    // Reveal on scroll
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var selectors = [
        '.cover > *', '.page-cover > *', '.deck p', '.spread .statement',
        '.index-title', '.index-row', '.running-head', '.look',
        '.atelier h2', '.at-copy', '.at-note', '.code-wrap',
        '.facing-lede', '.facing-body', '.facing-col',
        '.book-lede', '.book-entry', '.edition', '.editions-note',
        '.essay .measure > p', '.essay .pull', '.essay h3', '.thm',
        '.qa-item', '.finale > *'
    ];
    var els = Array.prototype.slice.call(document.querySelectorAll(selectors.join(',')));
    var perParent = new Map();
    els.forEach(function (el) {
        el.classList.add('reveal');
        var p = el.parentElement;
        var n = perParent.get(p) || 0;
        el.style.transitionDelay = Math.min(n * 110, 550) + 'ms';
        perParent.set(p, n + 1);
    });

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) {
                e.target.classList.add('on');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
})();
