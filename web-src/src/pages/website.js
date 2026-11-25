/* ===================================================================
   Page: Website (#page=website&full=0)   Owner: builder 5
   The website templates gallery from the owner's request lives in sites.js (shared with the sample bar). This file
   registers it as a page and feeds every design with the company's own content: the active FAQs (FAQs page), the
   reviews (Reviews page), and the hero image, brand logos, social buttons and form receiving number (Home Settings).
   =================================================================== */
var websiteBaseRender = renderSite, legacyWebsite = PAGES.website;
function wsStars(n) { var s = ''; for (var k = 1; k <= 5; k++) s += k <= n ? '★' : '☆'; return '<span class="ws-stars" aria-label="' + n + ' out of 5">' + s + '</span>'; }
function wsFeed(b) {
  var d = b.data, h = d.home || { logos: [], socials: [], hero: {} };
  var faqs = d.faqs.filter(function (f) { return f.active; }).sort(function (a, z) { return a.order - z.order; });
  var revs = d.reviews.slice().sort(function (a, z) { return a.order - z.order; });
  var logos = h.logos.slice().sort(function (a, z) { return a.order - z.order; });
  var socials = h.socials.filter(function (s) { return s.active; }).sort(function (a, z) { return a.order - z.order; });
  var wa = UI.waNumber(h.formNumber || b.phone || '').replace(/\D/g, '');
  return {
    faq: faqs.length ? '<div class="ws-faq">' + faqs.slice(0, 8).map(function (f, k) { return '<details' + (k === 0 ? ' open' : '') + '><summary><span>' + esc(f.q) + '</span><b aria-hidden="true">+</b></summary><p>' + esc(f.a) + '</p></details>'; }).join('') + '</div>' : '',
    reviews: revs.length ? '<div class="ws-sec ws-revs"><h2>What renters say</h2><div class="ws-rev-grid">' + revs.slice(0, 6).map(function (r) { return '<figure class="ws-rev">' + wsStars(r.rating) + '<blockquote>' + esc(r.text) + '</blockquote><figcaption>' + (r.photo ? '<img src="' + r.photo + '" alt="">' : '<span class="ws-av">' + esc(initials(r.name)) + '</span>') + '<span><b>' + esc(r.name) + '</b><small>' + UI.fmt.month(r.date) + '</small></span></figcaption></figure>'; }).join('') + '</div></div>' : '',
    logos: logos.length ? '<div class="ws-logos" aria-label="Car makes we rent out">' + logos.map(function (l) { return '<span title="' + esc(l.name) + '">' + (l.img ? '<img src="' + l.img + '" alt="' + esc(l.name) + '">' : esc(l.name)) + '</span>'; }).join('') + '</div>' : '',
    socials: socials.length ? '<div class="ws-soc">' + socials.map(function (s) { return '<a href="' + esc(s.link) + '" target="_blank" rel="noopener" title="' + esc(s.name) + '" aria-label="' + esc(s.name) + '">' + (s.logo && s.logo.indexOf('icon:') === 0 ? i(s.logo.slice(5)) : s.logo ? '<img src="' + s.logo + '" alt="">' : esc(s.name[0])) + '</a>'; }).join('') + '</div>' : '',
    wa: wa ? '<a class="ws-wa" href="https://wa.me/' + wa + '" target="_blank" rel="noopener" title="WhatsApp ' + esc(h.formNumber || b.phone) + '">' + SI.wa + '</a>' : '',
    hero: h.hero && h.hero.img ? h.hero.img : null
  };
}
/* every design, with the company's FAQs, reviews, logos, social buttons, hero picture and WhatsApp number */
renderSite = function (t, b) {
  var html = websiteBaseRender(t, b), f = wsFeed(b);
  if (t === 0) {
    if (f.hero) html = html.replace('<div class="t1-hero">', '<div class="t1-hero ws-hero" style="background-image:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.75)),url(' + f.hero + ')">');
    var faqRe = /<div class="t1-faq">[\s\S]*?<\/div><\/div><\/div><div class="t1-foot"/;
    if (faqRe.test(html)) html = html.replace(faqRe, function () { return (f.faq || '<p class="lead">Questions? Message us on WhatsApp.</p>') + '</div>' + f.logos + f.reviews + '</div><div class="t1-foot"'; });
    html = html.replace('<span class="t1-wa">' + SI.wa + '</span>', f.socials + '<a class="t1-wa" href="' + (f.wa.match(/href="([^"]+)"/) || [0, '#'])[1] + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + SI.wa + '</a>');
    return html;
  }
  if (t === 1) {
    if (f.hero) html = html.replace(/<div class="t2-blob">[\s\S]*?<\/svg><\/div>/, '<div class="t2-blob ws-blob"><img src="' + f.hero + '" alt=""></div>');
    html = html.replace('<div class="t2-cta">', f.logos + f.reviews + (f.faq ? '<div class="t2-sec"><h2>Questions</h2><p class="lead">The things people ask us most.</p>' + f.faq + '</div>' : '') + '<div class="t2-cta">');
    html = html.replace('<div class="t2-foot">', '<div class="t2-foot ws-foot">' + f.socials);
    return html.replace(/<\/div>$/, f.wa + '</div>');
  }
  if (f.hero) html = html.replace(/<div class="r">[\s\S]*?<\/svg>/, '<div class="r ws-r"><img src="' + f.hero + '" alt="">');
  html = html.replace('<div class="t3-foot">', f.logos + f.reviews + (f.faq ? '<div class="ws-sec"><h2>Questions</h2>' + f.faq + '</div>' : '') + '<div class="t3-foot ws-foot">' + f.socials);
  return html.replace(/<\/div>$/, f.wa + '</div>');
};
function wsFeedCard(b) {
  var d = b.data, h = d.home, act = d.faqs.filter(function (f) { return f.active; }).length, avg = d.reviews.length ? d.reviews.reduce(function (s, r) { return s + r.rating; }, 0) / d.reviews.length : 0;
  var tile = function (icon, title, line, page, need) { return '<div class="ws-tile"><span class="ws-ti">' + i(icon) + '</span><div class="grow"><div class="t1c fw5">' + title + '</div><div class="b2">' + line + '</div></div>' + (pageAllowed(page) ? '<button type="button" class="btn t sm" data-a="nav" data-v="' + page + '">' + (can(need) ? 'Edit' : 'Open') + i('arrow-right') + '</button>' : '') + '</div>'; };
  return '<div class="card mb24 ws-feed"><div class="card-h"><div><h3>What your website shows</h3><p>Every design reads these, so a change on these pages shows on the website straight away. Publish to put it live.</p></div></div><div class="card-b ws-tiles">' +
    tile('help-circle', 'FAQs', act + ' of ' + d.faqs.length + ' questions active', 'faqs', 'faqs.edit') +
    tile('star', 'Reviews', plural(d.reviews.length, 'review') + (d.reviews.length ? ', ' + avg.toFixed(1) + ' stars on average' : ''), 'reviews', 'reviews.edit') +
    tile('photo', 'Hero image and logos', (h.hero && h.hero.img ? 'Your own hero picture' : 'Your car as the hero picture') + ', ' + plural(h.logos.length, 'brand logo'), 'home-settings', 'home_settings.edit') +
    tile('brand-whatsapp', 'Contact and social buttons', esc(h.formNumber || 'No number') + ', ' + h.socials.filter(function (s) { return s.active; }).length + ' social buttons on', 'home-settings', 'home_settings.edit') +
    tile('car', 'Cars and prices', plural(siteCars(b).length, 'car model') + ' shown, from the Cars page', 'cars', 'cars.edit') +
    tile('building', 'Company details', esc(b.legal) + ', from Settings', 'settings', 'billing.settings') + '</div></div>';
}
PAGES['website'] = {
  title: 'Website',
  render: function (root, ctx) {
    /* the shared .lg login class (ui.css) stretches anything named lg to the screen height, so the size classes are swapped here */
    var html = legacyWebsite().replace('class="av sq lg"', 'class="av sq ws-avlg"').replace(/class="chip( ok| warn)? lg"/g, 'class="chip$1 ws-chiplg"'), card = wsFeedCard(ctx.brand), at = html.indexOf('<div class="row wrap mb16"');
    return at > 0 ? html.slice(0, at) + card + html.slice(at) : html + card;
  },
  search: [{ label: 'Preview the website', icon: 'eye', keywords: 'site template design', run: function () { A.wsprev(S.ws.cur[B().id] || 0); } }]
};
