"""OCP S1 concept geometry. Millimetres; no external dependencies."""
import json, math
from pathlib import Path

OUT = Path(__file__).parent
parts = []
def mesh(name, vertices, faces, group, tone=0.55, internal=False):
    parts.append(dict(name=name,v=vertices,f=faces,g=group,t=tone,internal=internal))
def ring(name, x,y,z,ro,ri,h,group,tone=.6,internal=False,n=48):
    v=[]
    for zz,r in [(z,ro),(z+h,ro),(z,ri),(z+h,ri)]:
        v += [[x+r*math.cos(i*2*math.pi/n),y+r*math.sin(i*2*math.pi/n),zz] for i in range(n)]
    f=[]
    for i in range(n):
        j=(i+1)%n
        f += [[i,j,n+j,n+i],[2*n+i,3*n+i,3*n+j,2*n+j],
              [n+i,n+j,3*n+j,3*n+i],[i,2*n+i,2*n+j,j]]
    mesh(name,v,f,group,tone,internal)
def box(name,x,y,z,dx,dy,dz,group,tone=.6,internal=False):
    v=[[x+a*dx,y+b*dy,z+c*dz] for a,b,c in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]]
    mesh(name,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],group,tone,internal)

ring('01 / Telo · Ø90 × 210 / zid 4',0,0,0,45,41,210,'body',.7)
ring('02 / Gornji poklopac · Ø112 × 12',0,0,210,56,6,12,'top',.6)
ring('02 / Unutrašnji čep',0,0,197,40.8,6,13,'top',.55)
ring('03 / Donja ploča · priključci sondi',0,0,-12,56,0,12,'bottom',.55)
ring('03 / Unutrašnji čep',0,0,0,40.8,0,13,'bottom',.55)
for z,g in [(200,'top'),(207,'top'),(3,'bottom'),(10,'bottom')]:
    ring('04 / Zaptivni prsten · koncept',0,0,z,41.15,39.1,2,g,.15)
ring('05 / Kablovski uvodnik · kućište',0,0,222,11,4,17,'top',.32,n=6)
ring('05 / Uvodnik · stezna kapa',0,0,239,9,4,8,'top',.3)
ring('05 / Kabl Ø8 · nastavak van modela',0,0,247,4,0,11,'top',.15)
for i in range(4):
    a=math.pi/4+i*math.pi/2;x,y=50*math.cos(a),50*math.sin(a)
    ring('06 / Vezna šipka M4',x,y,-16,2,0,242,'rods',.55,n=12)
    for z in [-18,222]:ring('06 / Matica M4 · pojednostavljena',x,y,z,4,2,4,'rods',.4,n=6)
for z in [42,165]:
    ring('07 / Montažna obujmica',0,0,z,49,45,14,'mount',.32)
    box('07 / Distancer nosača',-16,43,z,32,17,14,'mount',.4)
box('07 / Zadnji nosač',-24,60,32,48,6,160,'mount',.45)
box('08 / Elektronska ploča · 48 × 150',-24,-1,30,48,2,150,'electronics',.28,True)
for z in [40,85,134]:box('08 / Elektronika · rezervisan prostor',-16,1,z,32,10,22,'electronics',.16,True)
for x in [-27,24]:box('08 / Vođica ploče',x,-5,22,3,10,164,'electronics',.5,True)
probes=[('09 / Optički kiseonik',-22,-22,11,-106),('10 / pH elektroda',22,-22,7,-112),('11 / Provodljivost',22,22,10,-96),('12 / Temperatura',-22,22,5,-88)]
for name,x,y,r,z in probes:
    ring(name+' / prihvat',x,y,-27,r+3,0,15,'probes',.35,n=6)
    ring(name,x,y,z,r,0,-27-z,'probes',.65)
    ring(name+' / merna površina',x,y,z-4,r*.85,0,4,'probes',.2)
ring('13 / Zaštitna korpa · donji prsten',0,0,-130,54,48,8,'guard',.35)
ring('13 / Zaštitna korpa · gornji prsten',0,0,-22,54,48,10,'guard',.35)
for i in range(8):
    a=i*math.pi/4
    ring('13 / Rebro korpe',51*math.cos(a),51*math.sin(a),-122,2.5,0,100,'guard',.4,n=8)

(OUT/'geometry.json').write_text(json.dumps(parts,separators=(',',':')),encoding='utf-8')
obj=['# OCP S1 conceptual assembly; units mm; visual envelopes, not manufacturing solids']
offset=1
for p in parts:
    obj.append('o '+p['name'].replace(' ','_').replace('/','_'))
    obj.extend('v '+' '.join(f'{x:.5f}' for x in v) for v in p['v'])
    for f in p['f']:
        for i in range(1,len(f)-1):obj.append('f '+' '.join(str(offset+j) for j in [f[0],f[i],f[i+1]]))
    offset+=len(p['v'])
(OUT/'ocp-s1-assembly.obj').write_text('\n'.join(obj))
template=(OUT/'viewer.template.html').read_text()
fragment=template.replace('/*GEOMETRY*/[]',json.dumps(parts,separators=(',',':')))
(OUT/'ocp-s1-mechanical.html').write_text(fragment)
shell='''<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OCP S1 — mechanical concept</title><style>
:root{--foreground:#263a32;--background:#f6f5ef;--muted-foreground:#54665c;--border:#a6b0a6;color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font:15px/1.5 system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:28px}h2{font-size:24px;font-weight:500;margin:0 0 6px}.text-small{font-size:12px}.viz-controls,.viz-row{display:flex;flex-wrap:wrap;gap:16px;align-items:center}.form-label{display:grid;gap:5px}.form-check{display:flex;gap:8px;align-items:center}.form-select,.btn{font:inherit;color:inherit;background:transparent;border:1px solid var(--border);padding:8px 12px;border-radius:4px;max-width:100%}.btn{cursor:pointer}.btn:hover{background:#e2e7dc}.form-range{max-width:200px}.form-check-input{accent-color:#263a32}select{min-width:0}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #263a32;outline-offset:3px}@media(max-width:480px){main{padding:16px}.form-label{max-width:100%}}
</style></head><body><main>'''
(OUT/'index.html').write_text(shell+fragment+'</main></body></html>')
print(f'Generated {len(parts)} components; {offset-1} vertices.')

# A3 landscape vector drawing, view geometry in mm scaled to sheet units.
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 1400 990">',
 '<defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#86928b" stroke-width=".6"/></pattern><marker id="arr" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M8 4L0 1L0 7Z" fill="#33443d"/></marker></defs>',
 '<rect width="1400" height="990" fill="#f6f5ef"/><g stroke="#33443d" fill="none" stroke-width="1.2"><rect x="24" y="24" width="1352" height="942"/></g>']
def line(x1,y1,x2,y2,dash=False):svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#33443d" stroke-width="1"'+(' stroke-dasharray="6 5"' if dash else '')+'/>')
def txt(x,y,t,size=14,anchor='start'):svg.append(f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="{size}" text-anchor="{anchor}" fill="#25382e">{t}</text>')
def rect(x,y,w,h,fill='none'):svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="#33443d" stroke-width="1.2"/>')
def circle(x,y,r,fill='none'):svg.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="#33443d" stroke-width="1.2"/>')
def dim(x1,y1,x2,y2,label):
    svg.append(f'<path d="M{x1} {y1} L{x2} {y2}" fill="none" stroke="#33443d" stroke-width=".8" marker-start="url(#arr)" marker-end="url(#arr)"/>')
    txt((x1+x2)/2+8,(y1+y2)/2-8,label,13)
txt(55,72,'OCP / S1',30);txt(55,103,'SUBMERSIBLE WATER MONITOR · MECHANICAL CONCEPT',15)
txt(1340,70,'GENERAL ARRANGEMENT',17,'end');txt(1340,100,'REV A / 12 SEP 2026 / ALL DIMENSIONS mm',13,'end');line(24,125,1376,125)
s=1.02
def yy(z):return 440-(z-55)*s
for cx,cut in [(275,False),(725,True)]:
    txt(cx,170,'SECTION A–A' if cut else 'FRONT ELEVATION',16,'middle')
    line(cx,205,cx,667,True)
    rect(cx-45*s,yy(210),90*s,210*s,'url(#hatch)' if cut else '#e6e8e1')
    if cut:rect(cx-41*s,yy(210),82*s,210*s,'#f6f5ef')
    for z in [-12,210]:rect(cx-56*s,yy(z+12),112*s,12*s,'url(#hatch)' if cut else '#dde2da')
    for z in [0,197]:
        rect(cx-40.8*s,yy(z+13),81.6*s,13*s,'url(#hatch)' if cut else 'none')
    for z in [3,10,200,207]:
        for x in [-41,39]:rect(cx+x*s,yy(z+2),2*s,2*s,'#33443d')
    rect(cx-11*s,yy(239),22*s,17*s);rect(cx-9*s,yy(247),18*s,8*s);rect(cx-4*s,yy(258),8*s,11*s)
    for x in [-50,50]:rect(cx+(x-2)*s,yy(226),4*s,244*s)
    for z in [-130,-22]:rect(cx-54*s,yy(z+8),108*s,8*s)
    for x in [-51,0,51]:rect(cx+(x-2.5)*s,yy(-22),5*s,100*s)
    for x,r,z in [(-22,11,-106),(22,7,-112)]:
        rect(cx+(x-r)*s,yy(-12),2*r*s,(-12-z)*s,'#dde2da')
        rect(cx+(x-r*.85)*s,yy(z),r*1.7*s,4*s,'#63796a')
    if cut:
        rect(cx-24*s,yy(180),48*s,150*s,'#d0dbcf')
        for z in [40,85,134]:rect(cx-16*s,yy(z+22),32*s,22*s,'#879c89')
        for x in [-27,24]:rect(cx+x*s,yy(186),3*s,164*s)
    else:
        for z in [42,165]:rect(cx-49*s,yy(z+14),98*s,14*s)
        txt(cx,yy(125),'OCP',19,'middle');txt(cx,yy(105),'S1 / FIELD NODE',10,'middle')
    for z in [-130,258]:line(cx-62*s,yy(z),cx-116,yy(z))
    dim(cx-105,yy(-130),cx-105,yy(258),'388')
    line(cx-56*s,yy(-130)+25,cx-56*s,yy(-130)+55);line(cx+56*s,yy(-130)+25,cx+56*s,yy(-130)+55)
    dim(cx-56*s,yy(-130)+45,cx+56*s,yy(-130)+45,'Ø112')
    dim(cx+83,yy(0),cx+83,yy(210),'210')
cx,cy=1150,330
txt(cx,170,'TOP / PORT LAYOUT',16,'middle')
for r in [56,45,41]:circle(cx,cy,r*1.4)
line(cx-95,cy,cx+95,cy,True);line(cx,cy-95,cx,cy+95,True)
for a in [45,135,225,315]:circle(cx+70*math.cos(math.radians(a)),cy+70*math.sin(math.radians(a)),3.15)
for x,y in [(-22,-22),(22,-22),(22,22),(-22,22)]:circle(cx+x*1.4,cy+y*1.4,9*1.4)
txt(1022,451,'4 × Ø18 provisional sensor ports',14);txt(1022,475,'Centres: (±22, ±22)',14);txt(1022,499,'4 × Ø4.5 tie-rod holes / PCD 100',14)
txt(1022,554,'SEAL DETAIL / CONCEPT',15)
rect(1040,575,175,18,'url(#hatch)');rect(1040,607,175,30,'url(#hatch)');circle(1080,604,9,'#63796a');circle(1170,604,9,'#63796a')
txt(1022,665,'2 radial seals at each cap',14);txt(1022,689,'Grooves and squeeze: verify before manufacture',12)
line(24,720,1376,720)
txt(55,752,'ASSEMBLY INDEX',15)
labels=['01  Tube / Ø90 OD · Ø82 ID · L210','02  Top cap / cable entry','03  Bottom cap / 4 sensor adapters','04  Radial seals / 4 total','05  Cable gland / Ø8 cable','06  M4 tie rods / 4 total','07  Mounting collars + rear plate','08  PCB / 48 × 150 + guide rails','09  Optical dissolved oxygen probe','10  pH probe','11  Conductivity probe','12  Temperature probe','13  Open protective cage / Ø108']
for i,t in enumerate(labels):txt(55+(i//5)*360,782+(i%5)*25,t,13)
line(24,914,1376,914);txt(55,943,'CONCEPT ONLY · NOT FOR MANUFACTURE · SENSOR ENVELOPES · NO VERIFIED PRESSURE RATING',13);txt(1345,943,'OCP–S1–GA–001 / A3 / NTS',13,'end')
svg.append('</svg>');(OUT/'ocp-s1-drawing.svg').write_text('\n'.join(svg))
