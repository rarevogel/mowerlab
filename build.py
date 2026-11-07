#!/usr/bin/env python3
"""Maakt dist/mowerlab.html (één zelfstandig bestand) en android/assets/index.html."""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parent
web = ROOT / "web"
html = (web / "index.html").read_text(encoding="utf-8")
html = re.sub(r'<script src="([^"]+)"></script>', lambda m: "<script>/* " + m.group(1) + " */\n" + (web / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script") + "\n</script>", html)
out = ROOT / "dist" / "mowerlab.html"; out.parent.mkdir(exist_ok=True); out.write_text(html, encoding="utf-8")
a = ROOT / "android" / "assets"; a.mkdir(parents=True, exist_ok=True); (a / "index.html").write_text(html, encoding="utf-8")
print(out, len(html) // 1024, "KB")
