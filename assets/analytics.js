// Microsoft Clarity (heatmaps, clicks, grabaciones de sesión)
(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "xq4rcwwzt2");

// Google Analytics 4 (visitas y estadísticas)
(function(){
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-878T3NRZDV';
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', 'G-878T3NRZDV');
})();

// Rastreo de clicks: enlaces de contacto (WhatsApp, Instagram, Maps), tarjetas
// de producto (.pcard, en cualquier página de categoría) y, como respaldo,
// cualquier otro link o botón del sitio — así no hace falta acordarse de
// instrumentar cada elemento nuevo a mano.
function trackEvent(name, params){
    if (window.gtag) window.gtag('event', name, params);
    if (window.clarity) window.clarity('event', name);
}

var LINK_EVENTS = [
    { match: 'wa.me', name: 'whatsapp_click' },
    { match: 'instagram.com', name: 'instagram_click' },
    { match: 'google.com/maps', name: 'maps_click' }
];

document.addEventListener('click', function(e){
    var link = e.target.closest('a[href]');
    var href = link ? (link.getAttribute('href') || '') : '';
    var rule = link && LINK_EVENTS.find(function(r){ return href.indexOf(r.match) !== -1; });
    if (rule) {
        var label = (link.getAttribute('aria-label') || link.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100) || rule.name;
        trackEvent(rule.name, { button_label: label, page_path: location.pathname });
        return;
    }

    // Tarjeta de producto: un solo evento con el nombre, sin importar en qué
    // parte de la tarjeta cayó el click (foto, título, "Ver en la tienda").
    var card = e.target.closest('.pcard');
    if (card) {
        var title = card.querySelector('h3');
        trackEvent('product_click', {
            item_name: title ? title.textContent.trim() : '',
            page_path: location.pathname
        });
        return;
    }

    // Respaldo genérico: cualquier otro link o botón (nav, chips, filtros,
    // "leer más", puntos de galería, etc). El WhatsApp y el "Compartir" del
    // reel de Explorar ya mandan su propio evento más completo (con producto
    // y, en el caso de WhatsApp, también el genérico de arriba) — se excluyen
    // acá para no duplicarlos con una versión más pobre.
    var el = e.target.closest('a[href], button');
    if (!el) return;
    if (el.classList.contains('wa-cta') || el.classList.contains('share-btn')) return;
    var elLabel = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    trackEvent('click', { element_label: elLabel, element_tag: el.tagName.toLowerCase(), page_path: location.pathname });
}, true);

// Rastreo de búsquedas dentro de las páginas de categorías (buscador "catSearch")
(function(){
    var lastTerm = '';
    var timer = null;
    document.addEventListener('input', function(e){
        if (e.target.id !== 'catSearch') return;
        clearTimeout(timer);
        timer = setTimeout(function(){
            var term = e.target.value.trim();
            if (term.length < 2 || term === lastTerm) return;
            lastTerm = term;
            trackEvent('site_search', { search_term: term, page_path: location.pathname });
        }, 800);
    }, true);
})();
