from pathlib import Path
import xml.etree.ElementTree as ET
import json

svg_path = Path('src/shared/assets/logo/LogoAndysVector.svg')
output_path = Path('src/shared/assets/logo/LogoAndysVector.tsx')

root = ET.parse(svg_path).getroot()
ns = {'svg': 'http://www.w3.org/2000/svg'}
viewBox = root.attrib.get('viewBox', '0 0 228.60001 325.96667')
group = root.find('.//{http://www.w3.org/2000/svg}g')
transform = group.attrib.get('transform', '') if group is not None else ''
paths = root.findall('.//{http://www.w3.org/2000/svg}path')
if not paths:
    raise SystemExit('No <path> found in SVG')

path_lines = []
for p in paths:
    d = p.attrib.get('d', '')
    path_lines.append(f'        <path fill="currentColor" d={json.dumps(d)} />')

svg_code = f"""import type {{ SVGProps }} from 'react'

type LogoAndysVectorProps = SVGProps<SVGSVGElement> & {{ color?: string }}

export function LogoAndysVector({ color = 'currentColor', className = '', ...props }: LogoAndysVectorProps) {{
  return (
    <svg
      viewBox={json.dumps(viewBox)}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ color }}
      aria-hidden="true"
      {...props}
    >
      <g transform={json.dumps(transform)}>
{chr(10).join(path_lines)}
      </g>
    </svg>
  )
}}
"""
output_path.write_text(svg_code, encoding='utf-8')
print('created', output_path)
