import numpy as np, json, sys, os
from PIL import Image, ImageDraw
from scipy import ndimage as nd
src0=Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../../public/assets/vvs/logo-mark.png')).convert('RGBA')
PAD=24
src=Image.new('RGBA',(src0.size[0]+2*PAD,src0.size[1]+2*PAD),(0,0,0,0)); src.paste(src0,(PAD,PAD))
# the cut-out ate a highlight stripe on the S's right side (source x~620-633, y~150-212):
# close that crack locally so the S's outer edge stays whole
_a=np.asarray(src).copy(); _x0,_x1,_y0,_y1=595+PAD,645+PAD,135+PAD,240+PAD
_al=_a[_y0:_y1,_x0:_x1,3]
_cl=nd.grey_closing(_al,footprint=np.hypot(*np.mgrid[-8:9,-8:9])<=8)
_new=_cl>_al
_a[_y0:_y1,_x0:_x1,3]=_cl
# give the filled pixels the colour of their nearest opaque neighbour
_rgb=_a[_y0:_y1,_x0:_x1,:3]; _idx=nd.distance_transform_edt(_al<200,return_distances=False,return_indices=True)
_rgb[_new]=_rgb[_idx[0][_new],_idx[1][_new]]
src=Image.fromarray(_a)
# work at 4x for the shape (no stair steps), output the mesh at 2x
SS=4; W4,H4=src.size[0]*SS, src.size[1]*SS
im4=np.asarray(src.resize((W4,H4),Image.LANCZOS)).astype(float)
A4=nd.gaussian_filter(im4[...,3],SS*1.6)>127
A4=nd.binary_fill_holes(A4)
# the S: the source is clipped by its canvas on the right and the cut-out left nicks and
# a hooked tip, so fair its outline (curvature flow: blur the mask, re-threshold), blended in
xx4=np.arange(W4)[None,:]
w4=np.clip((xx4-(530+PAD)*SS)/(30*SS),0,1)
_f=nd.gaussian_filter(nd.binary_closing(A4,structure=np.ones((3,3)),iterations=3*SS).astype(float),3.2*SS)
A4=((1-w4)*A4+w4*_f)>0.5
A4=nd.binary_fill_holes(A4)
# the lower bowl's outer edge: the source canvas clips it at x=639 (rows ~186-210) and it has
# small nicks, so refit it as one smooth curve and rebuild the mask out to that curve
from scipy.interpolate import UnivariateSpline
_ys=np.arange((98+PAD)*SS,(274+PAD)*SS); _r=np.array([np.where(A4[y])[0].max() for y in _ys])
_src=np.asarray(src0)[...,3]>127
_keep=np.array([ (np.where(_src[min(max(y//SS-PAD,0),src0.size[1]-1)])[0].max()<637) for y in _ys])
_sp=UnivariateSpline(_ys[_keep],_r[_keep],k=4,s=len(_ys)*(0.35*SS)**2)
_fit=np.round(_sp(_ys)).astype(int)
_xmin=(585+PAD)*SS
for y,f in zip(_ys,_fit):
    run=np.where(A4[y,_xmin:])[0]
    if not len(run): continue
    A4[y,_xmin+run.min():f+1]=True; A4[y,f+1:]=False
A4=nd.gaussian_filter(A4.astype(float),SS*0.8)>0.5
# the top terminal's end: round off the nick at its lower corner
_disk=np.hypot(*np.mgrid[-4*SS:4*SS+1,-4*SS:4*SS+1])<=4*SS
_t=nd.gaussian_filter(nd.binary_opening(A4,structure=_disk).astype(float),SS*1.5)>0.5
_reg=np.zeros_like(A4); _reg[:(96+PAD)*SS,(596+PAD)*SS:]=True
_reg=nd.gaussian_filter(_reg.astype(float),3*SS)
A4=((1-_reg)*A4+_reg*_t)>0.5
# the inner tip of the S's top stroke curls into a little hook in the source: fair it too
_t=nd.gaussian_filter(nd.binary_opening(nd.binary_closing(A4,structure=_disk),structure=_disk).astype(float),SS*1.5)>0.5
_reg=np.zeros_like(A4,dtype=float); _reg[(55+PAD)*SS:(120+PAD)*SS,(470+PAD)*SS:(550+PAD)*SS]=1
_reg=nd.gaussian_filter(_reg,3*SS)
A4=((1-_reg)*A4+_reg*_t)>0.5
rgb=im4[...,:3]/255; mx=rgb.max(-1); mn=rgb.min(-1); sat=(mx-mn)/np.maximum(mx,1e-3)
yy,xx=np.mgrid[0:H4,0:W4]
Z4=A4&(sat<0.30)&(yy<(0.42*src0.size[1]+PAD)*SS)
Z4=nd.binary_closing(Z4,iterations=18); Z4=nd.binary_fill_holes(Z4)&A4; Z4=nd.binary_opening(Z4,iterations=10)
lab,n=nd.label(Z4); sizes=nd.sum(Z4,lab,range(1,n+1)); Z4=np.isin(lab,[i+1 for i,s in enumerate(sizes) if s>24000])
# the iced band ends on one level line (the median of where the traced panel ends), not the
# wavy colour edge, so the gold/stone seam reads as deliberate
_bot=[np.where(Z4[:,x])[0].max() for x in range(W4) if Z4[:,x].any()]
YCUT=int(np.median(_bot)); print('ycut src', YCUT/SS-PAD)
Z4=A4&(yy<YCUT)
Z4=nd.gaussian_filter(Z4.astype(float),34)>0.5
d4=nd.distance_transform_edt(A4)
R=24*SS/2  # 12 source px
Z4=Z4&(d4>R*0.8)
# height: a rounded edge, then a gentle crown towards the middle of each stroke
prof=np.sqrt(np.clip(1-(1-np.minimum(d4,R)/R)**2,0,1))*R
crown=np.clip((d4-R)/(5*R),0,1); crown=crown*crown*(3-2*crown)*R*0.32
h4=prof+crown
dz=nd.distance_transform_edt(Z4)
rim=np.sqrt(np.clip(1-(1-np.minimum(dz,R*0.45)/(R*0.45))**2,0,1))
plate=R*0.6+rim*R*0.07
# blend into the plate over a short slope so the panel edge is a clean step, not a jag
t=np.clip(dz/(R*0.25),0,1)
h4=np.where(Z4,h4*(1-t)+plate*t,h4)
h4=np.where(A4,nd.gaussian_filter(h4,SS*1.4),0)
# down to 2x for the mesh
k=SS//2
H2,W2=H4//k,W4//k
def down(a,mode='mean'):
    a=a[:H2*k,:W2*k].reshape(H2,k,W2,k)
    return a.mean(axis=(1,3))
h=down(h4)/k; A=down(A4.astype(float))>0.5; Z=down(Z4.astype(float))>0.5
dz2=nd.distance_transform_edt(Z)
r=float(sys.argv[1]) if len(sys.argv)>1 else 8.5
r*=2; sp=r*2.12
best=[]
for ox in np.linspace(0,sp,7):
  for oy in np.linspace(0,sp*0.866,5):
    st=[]; row=0; y=oy+r
    while y<H2:
        x=ox+r+(sp/2 if row%2 else 0)
        while x<W2:
            if Z[int(y),int(x)] and dz2[int(y),int(x)]>=r*1.02: st.append([x,y,r])
            x+=sp
        y+=sp*0.866; row+=1
    if len(st)>len(best): best=st
stones=best; pts=np.array([[s[0],s[1]] for s in stones]); beads=[]
for i in range(len(pts)):
    for j in range(i+1,len(pts)):
        if abs(np.linalg.norm(pts[i]-pts[j])-sp)>2: continue
        for kk in range(j+1,len(pts)):
            if abs(np.linalg.norm(pts[i]-pts[kk])-sp)>2 or abs(np.linalg.norm(pts[j]-pts[kk])-sp)>2: continue
            beads.append(((pts[i]+pts[j]+pts[kk])/3).tolist())
for i in range(len(pts)):
    for j in range(i+1,len(pts)):
        if abs(np.linalg.norm(pts[i]-pts[j])-sp)>2: continue
        m=(pts[i]+pts[j])/2; dv=(pts[j]-pts[i])/sp; nrm=np.array([-dv[1],dv[0]])
        for sg in (1,-1):
            b=m+nrm*sg*r*0.72; bi,bj=int(b[1]),int(b[0])
            if 0<=bi<H2 and 0<=bj<W2 and Z[bi,bj] and not any(np.linalg.norm(b-np.array(c))<r*0.6 for c in beads): beads.append(b.tolist())
print('stones',len(stones),'beads',len(beads),'grid',W2,H2)
json.dump({'w':W2,'h':H2,'step':1,'gw':W2,'gh':H2,'R':R/k,'height':[round(float(v),3) for v in h.ravel()],'inside':A.ravel().astype(int).tolist(),'pave':Z.ravel().astype(int).tolist(),'stones':[[round(x,1),round(y,1),round(rr,1)] for x,y,rr in stones],'beads':[[round(x,1),round(y,1)] for x,y in beads]},open('mark.json','w'))
dbg=np.zeros((H2,W2,3),np.uint8); dbg[A]=(200,160,60); dbg[Z]=(220,220,220)
img=Image.fromarray(dbg); dr=ImageDraw.Draw(img)
for x,y,rr in stones: dr.ellipse((x-rr,y-rr,x+rr,y+rr),outline=(40,40,200),width=2)
img.resize((W2//2,H2//2)).save('debug.png')
