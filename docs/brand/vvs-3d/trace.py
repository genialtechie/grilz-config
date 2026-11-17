import numpy as np, json, sys
from PIL import Image, ImageDraw
from scipy import ndimage as nd
im=Image.open('/home/user/grilz-config/public/assets/vvs/logo-mark.png').convert('RGBA')
SC=2; W,H=im.size[0]*SC, im.size[1]*SC
im=im.resize((W,H),Image.LANCZOS)
a=np.asarray(im).astype(float)
A=nd.gaussian_filter(a[...,3],2.0)>127
A=nd.binary_fill_holes(A)
rgb=a[...,:3]/255; mx=rgb.max(-1); mn=rgb.min(-1); sat=(mx-mn)/np.maximum(mx,1e-3)
yy,xx=np.mgrid[0:H,0:W]
Z=A&(sat<0.30)&(yy<0.42*H)
Z=nd.binary_closing(Z,iterations=10)
Z=nd.binary_fill_holes(Z)&A
Z=nd.binary_opening(Z,iterations=6)
lab,n=nd.label(Z); sizes=nd.sum(Z,lab,range(1,n+1)); keep=[i+1 for i,s in enumerate(sizes) if s>6000]
Z=np.isin(lab,keep)
Z=nd.gaussian_filter(Z.astype(float),16)>0.5
d0=nd.distance_transform_edt(A)
Z=Z&(d0>12*SC*0.8)
d=nd.distance_transform_edt(A)
R=12*SC
prof=np.sqrt(np.clip(1-(1-np.minimum(d,R)/R)**2,0,1))*R
# a soft ridge down each stroke, like the polished letters of the mark
ridge=np.clip((d-R)/(4*R),0,1)*R*0.35
h=prof+ridge
dz=nd.distance_transform_edt(Z)
# the pave plate: flat, a step below the gold, its own small rounded rim
rim=np.sqrt(np.clip(1-(1-np.minimum(dz,R*0.4)/(R*0.4))**2,0,1))
h[Z]=(R*0.62+rim*R*0.08)[Z]
h=np.where(A,nd.gaussian_filter(h,2.6),0)
step=1
hs=h[::step,::step]; As=A[::step,::step]; Zs=Z[::step,::step]
r=float(sys.argv[1]) if len(sys.argv)>1 else 8.0
r*=SC; sp=r*2.12
best=[]
for ox in np.linspace(0,sp,5):
  for oy in np.linspace(0,sp*0.866,4):
    st=[]; row=0; y=oy+r
    while y<H:
        x=ox+r+(sp/2 if row%2 else 0)
        while x<W:
            if Z[int(y),int(x)] and dz[int(y),int(x)]>=r*1.02: st.append([x,y,r])
            x+=sp
        y+=sp*0.866; row+=1
    if len(st)>len(best): best=st
stones=best
beads=[]
for i,(x1,y1,_) in enumerate(stones):
    for (x2,y2,_) in stones[i+1:]:
        for (x3,y3,_) in stones:
            pass
# beads at the centres of each triangle of neighbouring stones (where prongs meet)
pts=np.array([[s[0],s[1]] for s in stones])
for i in range(len(pts)):
    for j in range(i+1,len(pts)):
        if abs(np.linalg.norm(pts[i]-pts[j])-sp)>2: continue
        for k in range(j+1,len(pts)):
            if abs(np.linalg.norm(pts[i]-pts[k])-sp)>2 or abs(np.linalg.norm(pts[j]-pts[k])-sp)>2: continue
            c=(pts[i]+pts[j]+pts[k])/3; beads.append(c.tolist())
# edge beads: where a stone touches the rim, a bead in the gap between neighbours along the edge
for i in range(len(pts)):
    for j in range(i+1,len(pts)):
        if abs(np.linalg.norm(pts[i]-pts[j])-sp)>2: continue
        m=(pts[i]+pts[j])/2; dv=(pts[j]-pts[i])/sp; nrm=np.array([-dv[1],dv[0]])
        for sg in (1,-1):
            b=m+nrm*sg*r*0.72
            bi,bj=int(b[1]),int(b[0])
            if 0<=bi<H and 0<=bj<W and Z[bi,bj] and not any(np.linalg.norm(b-np.array(c))<r*0.6 for c in beads): beads.append(b.tolist())
print('pave px',int(Z.sum()),'panels',len(keep),'stones',len(stones),'beads',len(beads))
json.dump({'w':W,'h':H,'step':step,'gw':hs.shape[1],'gh':hs.shape[0],'R':R,'height':[round(float(v),2) for v in hs.ravel()],'inside':As.ravel().astype(int).tolist(),'pave':Zs.ravel().astype(int).tolist(),'stones':[[round(x,1),round(y,1),round(rr,1)] for x,y,rr in stones],'beads':[[round(x,1),round(y,1)] for x,y in beads]},open('mark.json','w'))
dbg=np.zeros((H,W,3),np.uint8); dbg[A]=(200,160,60); dbg[Z]=(220,220,220)
img=Image.fromarray(dbg); dr=ImageDraw.Draw(img)
for x,y,rr in stones: dr.ellipse((x-rr,y-rr,x+rr,y+rr),outline=(40,40,200),width=2)
for x,y in beads: dr.ellipse((x-3,y-3,x+3,y+3),fill=(180,40,40))
img.resize((W//2,H//2)).save('debug.png')
