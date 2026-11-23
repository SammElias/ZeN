import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]
ENGINE_REV = '01d1fe6c0a22be646b91605b686b8fd872f0262e'
SOURCES = Path(__file__).resolve().parent

def main():
    sys.stdout.reconfigure(encoding='utf8', errors='backslashreplace')
    sys.stderr.reconfigure(encoding='utf8', errors='backslashreplace')
    checkout = Path(sys.argv[1]).resolve()
    rev = subprocess.check_output(['git', '-C', str(checkout), 'rev-parse', 'HEAD'], text=True).strip()
    if rev != ENGINE_REV:
        raise SystemExit(f'Revisión de Archify esperada: {ENGINE_REV}. Recibida: {rev}')
    with tempfile.TemporaryDirectory(prefix='zen-archify-') as temporary:
        workspace = Path(temporary)
        engine = workspace / 'archify'
        shutil.copytree(checkout / 'archify', engine)
        template = engine / 'assets/template.html'
        html = template.read_text(encoding='utf8')
        system_default = "window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'"
        system_update = "apply(e.matches ? 'light' : 'dark');"
        if html.count(system_default) != 2 or html.count(system_update) != 1:
            raise SystemExit('La plantilla de Archify cambió. Revisa el arranque del tema.')
        html = html.replace(system_default, "'dark'").replace(system_update, "apply('dark');")
        narrow_view = """
  <style>
    @media (max-width: 600px) {
      html:not([data-embed="true"]):not([data-present="true"]) .diagram-container[data-wide-diagram="true"] > svg {
        width: 100%;
        min-width: 0;
      }
      html:not([data-embed="true"]):not([data-present="true"]) .diagram-container {
        padding-bottom: 7rem;
      }
      .diagram-container .diagram-nav {
        inset-inline: 0.5rem;
        max-width: none;
        flex-wrap: wrap;
        justify-content: center;
        overflow: visible;
      }
      .diagram-container .diagram-nav button { flex: 0 0 auto; }
    }
  </style>
"""
        html = html.replace('</head>', narrow_view + '</head>', 1)
        template.write_text(html, encoding='utf8')
        evidence = ROOT / 'release' / 'archify-diagrams'
        evidence.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='finalize-', dir=evidence) as receipts:
            def finalize(candidate):
                source = json.loads(candidate.read_text(encoding='utf8'))
                args = ['node', str(engine / 'bin/archify.mjs'), 'finalize', source['diagram_type'],
                        str(candidate.relative_to(ROOT)), source['meta']['output'], '--repo-root', '.',
                        '--quality', source['meta']['quality_profile'], '--out-dir', receipts, '--json']
                result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, encoding='utf8',
                                        env={**os.environ, 'ARCHIFY_UPDATE_CHECK_DISABLED': '1'})
                return candidate.stem, result
            results = [finalize(candidate) for candidate in sorted(SOURCES.glob('*.json'))]
            shutil.copytree(receipts, evidence / Path(receipts).name.replace('finalize-', 'gates-'), dirs_exist_ok=True)
            for name, result in results:
                print(name, result.stdout, result.stderr)
            if any(result.returncode for _, result in results):
                raise SystemExit(1)
    subprocess.run(['node', str(SOURCES / 'exportar.mjs')], cwd=ROOT, check=True)

if __name__ == '__main__':
    main()
