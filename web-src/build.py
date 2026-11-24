"""Builds app/index.html (the big-screen FMS demo at app.orbiquefms.com) from web-src/src.
Usage: python3 web-src/build.py    (run from the repository root or anywhere)"""
import json, re, os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OUT = os.path.join(HERE, '..', 'app', 'index.html')
PAGES = os.path.join(SRC, 'pages')
page_js = sorted(f for f in os.listdir(PAGES) if f.endswith('.js'))
page_css = sorted(f for f in os.listdir(PAGES) if f.endswith('.css'))
js_files = ['perms.js', 'core.js', 'data.js', 'ui.js', 'shell.js', 'bf.js', 'platform.js', 'sites.js'] + ['pages/' + f for f in page_js] + ['main.js']
css_files = ['style.css', 'ui.css'] + ['pages/' + f for f in page_css] + ['space.css']
css = '\n'.join('/* ---- ' + f + ' ---- */\n' + open(os.path.join(SRC, f)).read() for f in css_files)
js = '\n'.join('/* ---- ' + f + ' ---- */\n' + open(os.path.join(SRC, f)).read() for f in js_files)
svgs = json.load(open(os.path.join(HERE, 'rules_svgs.json')))
js = 'var RULE_SVGS = ' + json.dumps(svgs, ensure_ascii=False) + ';\n' + js
icons = open(os.path.join(HERE, 'tabler-icons.css')).read()
head = open(os.path.join(HERE, 'head.html')).read()
body = head + '<style>\n' + css + '\n/* Tabler icons used by the template system */\n' + icons + '\n</style>\n<div id="app"></div>\n<script>\n' + js + '\n</script>\n'
for bad in ['ventura', 'xtrecy']:
    if re.search(bad, body, re.I): print('FORBIDDEN word found:', bad)
used = set(re.findall(r"tabler-([a-z0-9-]+)", js + css)) | set(re.findall(r"i\(['\"]([a-z0-9-]+)['\"]", js))
used |= set(re.findall(r"icon:\s*['\"]([a-z0-9-]+)['\"]", js))
used |= set(re.findall(r"^\s*'[a-z-]+': \['[^']*', '([a-z0-9-]+)',", js, re.M))   # PAGE_META menu icons
have = set(re.findall(r'\.tabler-([a-z0-9-]+)\{', icons))
missing = sorted(u for u in used - have if not u.startswith('icon'))
ICONSET = os.environ.get('TABLER_JSON', '/home/claude/iconify/node_modules/@iconify-json/tabler/icons.json')
if missing and os.path.exists(ICONSET):
    data = json.load(open(ICONSET))['icons']; added = []
    for n in missing:
        if n in data:
            svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'>" + data[n]['body'].replace('"', "'").replace('currentColor', 'black') + '</svg>'
            enc = svg.replace('%', '%25').replace('<', '%3C').replace('>', '%3E').replace('#', '%23')
            added.append('.tabler-' + n + '{--svg: url("data:image/svg+xml,' + enc + '");}')
    if added:
        icons = icons.rstrip('\n') + '\n' + '\n'.join(added)
        open(os.path.join(HERE, 'tabler-icons.css'), 'w').write(icons)
        body = body.replace('/* Tabler icons used by the template system */\n', '/* Tabler icons used by the template system */\n', 1)
        print('added icons:', len(added))
    missing = [n for n in missing if n not in data]
if missing: print('Icons not found anywhere (they will not show):', missing[:40])
body = head + '<style>\n' + css + '\n/* Tabler icons used by the template system */\n' + icons + '\n</style>\n<div id="app"></div>\n<script>\n' + js + '\n</script>\n'
open(OUT, 'w').write(body)
print('built', OUT, round(len(body.encode()) / 1024), 'KB')
