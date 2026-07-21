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

// Rastreo de clicks en botones de WhatsApp (todas las páginas, incluido el botón flotante)
document.addEventListener('click', function(e){
    var link = e.target.closest('a[href*="wa.me"]');
    if (!link) return;
    var label = (link.getAttribute('aria-label') || link.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100) || 'WhatsApp';
    if (window.gtag) {
        window.gtag('event', 'whatsapp_click', {
            button_label: label,
            page_path: location.pathname
        });
    }
    if (window.clarity) {
        window.clarity('event', 'whatsapp_click');
    }
}, true);
