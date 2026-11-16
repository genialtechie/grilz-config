import numpy as np, json, base64, pickle, cc, geo
np.set_printoptions(suppress=True, linewidth=220)
TYPES=['inc','inc','can','pre','pre','mol','mol','mol']
def Ry(a): c,s=np.cos(a),np.sin(a); return np.array([[c,0,s],[0,1,0],[-s,0,c]])
RZ=np.diag([-1.,-1.,1.])
ROW=pickle.load(open('seated.pkl','rb'))
up=ROW['top']; lo=ROW['bottom']
sh=-min(t['S'][:,1].min() for t in up)
for t in up:
    for k in ('V','S'): t[k][:,1]+=sh
    t['zen']+=sh; t['tip']+=sh
sh=-max(t['S'][:,1].max() for t in lo)          # lower tips to y = 0 to start from
for t in lo:
    for k in ('V','S'): t[k][:,1]+=sh
    t['zen']+=sh; t['tip']+=sh
# close the bite: slide the lower arch back, then raise it until the back teeth are CL_BACK apart; the front teeth must then be CL_FRONT clear
CL_BACK,CL_FRONT=0.6,1.0
UPS=[t['S'].astype(np.float32) for t in up]+[(up[0]['S']*[-1,1,1]).astype(np.float32)]   # plus the left central
def vv(A,B):
    m=np.inf
    for s in range(0,len(A),512):
        d=((A[s:s+512,None,:]-B[None,:,:])**2).sum(2); m=min(m,float(d.min()))
    return np.sqrt(m)
def clear(lidx,uidx,dy,dz,reach=2.5):
    m=np.inf
    for j in lidx:
        L=(lo[j]['S']+[0,dy,dz]).astype(np.float32)
        for i in uidx:
            U=UPS[i]; l0=np.maximum(L.min(0),U.min(0))-reach; h0=np.minimum(L.max(0),U.max(0))+reach
            if (l0>h0).any(): continue
            a=L[((L>=l0)&(L<=h0)).all(1)]; b=U[((U>=l0)&(U<=h0)).all(1)]
            if len(a) and len(b): m=min(m,vv(a,b))
    return m
BACK=range(3,8); FRONT=range(0,3)
def raise_to(dz):
    a,b=-4.0,4.0
    for it in range(11):
        mid=(a+b)/2
        if clear(BACK,BACK,mid,dz)>=CL_BACK: a=mid
        else: b=mid
    return a
dz=-3.5; dy=raise_to(dz); print('first pass: dz %.2f dy %.3f front %.3f'%(dz,dy,clear(FRONT,list(FRONT)+[8],dy,dz)))
a,b=-9.0,0.0                                     # a is clear (far back), b collides
for it in range(11):
    mid=(a+b)/2
    if clear(FRONT,list(FRONT)+[8],dy,mid)>=CL_FRONT: a=mid
    else: b=mid
dz=a; dy=raise_to(dz)
for it in range(6):
    if clear(FRONT,list(FRONT)+[8],dy,dz)>=CL_FRONT: break
    dz-=0.1; dy=raise_to(dz)
print('BITE: lower dz %.3f, tips raised %.3f above the upper edge line; front clearance %.3f back clearance %.3f'%(dz,dy,clear(FRONT,list(FRONT)+[8],dy,dz),clear(BACK,BACK,dy,dz)))
# exact check
m=min(geo.min_dist(lo[j]['S']+[0,dy,dz],lo[j]['F'],up[i]['S'],up[i]['F'],reach=1.5) for j in range(8) for i in range(8) if abs(i-j)<=2)
print('exact smallest distance between upper and lower teeth %.3f'%m)
for t in lo:
    for k in ('V','S'): t[k]+=[0,dy,dz]
    t['zen']+=dy; t['tip']+=dy
# local frames
OUT={}
for row,ap,key in [('top',1,'U'),('bottom',-1,'L')]:
    teeth=ROW[row]; recs=[]
    gum=[t['zen']-ap*0.45 for t in teeth]
    for i in range(5,8): gum[i]=ap*min(ap*gum[i],ap*gum[4]+0.35)      # back teeth: keep the gum line near the premolars' level
    for i,t in enumerate(teeth):
        S,F=t['S'],t['F']; n,ar=geo.tri_normals(S,F); c=(S.min(0)+S.max(0))/2
        d=np.array([c[0],0,c[2]+10.]); d/=np.linalg.norm(d)
        for it in range(3):
            m=(n@d)>0.35; d=(n[m]*ar[m,None]).sum(0); d[1]=0; d/=np.linalg.norm(d)
        ang=np.arctan2(d[0],d[2])
        R=(RZ if ap>0 else np.eye(3))@Ry(-ang)                     # world -> local (after subtracting the base)
        Ls=S@R.T
        yg=(gum[i])*(-1 if ap>0 else 1)                             # local y of the gum line before shifting
        near=np.abs(Ls[:,1]-yg)<0.7
        x0=(Ls[:,0].min()+Ls[:,0].max())/2; z0=(Ls[near,2].min()+Ls[near,2].max())/2
        base=np.linalg.inv(R)@np.array([x0,yg,z0])                  # world position of the local origin
        Lc=(t['V']-base)@R.T; Ls=(S-base)@R.T
        w=np.ptp(Ls[:,0]); h=Ls[:,1].max(); nk=np.abs(Ls[:,1])<0.7; dep=np.ptp(Ls[nk,2])
        q=np.round(Lc*1000).astype('<i2'); assert np.abs(Lc).max()<32
        recs.append({'t':TYPES[i],'w':round(float(w),3),'h':round(float(h),3),'d':round(float(dep),3),'p':[round(float(x),3) for x in base],'a':round(float(ang),4),
                     'v':base64.b64encode(q.tobytes()).decode(),'q':base64.b64encode(t['Q'].astype('<u2').tobytes()).decode()})
        print(key,i,TYPES[i],'w %.2f h %.2f neck depth %.2f  base %s yaw %.1f deg  verts %d quads %d  face lean (tip z - neck z) %.2f'%(w,h,dep,np.round(base,2),np.degrees(ang),len(Lc),len(t['Q']),Ls[Ls[:,1]>h-1.5,2].mean()))
    OUT[key]=recs
js='  // ---------- the teeth: sixteen crown shapes measured from the hosted model (right side; the left side is their mirror image), stored as coarse cages that are smoothed when the page loads ----------\n  var TOOTH_DATA = '+json.dumps(OUT,separators=(',',':'))+';\n'
open('../25-teeth.js','w').write(js); print('data js bytes',len(js))
