import numpy as np, json, base64, arch, cc, geo
np.set_printoptions(suppress=True, linewidth=220)
TYPES=['inc','inc','can','pre','pre','mol','mol','mol']
def Ry(a): c,s=np.cos(a),np.sin(a); return np.array([[c,0,s],[0,1,0],[-s,0,c]])
RZ=np.diag([-1.,-1.,1.])
def extend_root(V,Q,ap):
    """carry the open (gum) end of a crown on as a short root stub, so the gum line can sit anywhere near it. ap = +1 when the root points to +y"""
    loop=cc.boundary_loop(Q); L=np.array(loop); c=V[L].mean(0); n=len(V)
    r1=V[L].copy(); r1[:,[0,2]]=c[[0,2]]+(V[L][:,[0,2]]-c[[0,2]])*0.95; r1[:,1]=c[1]+0.5*(V[L][:,1]-c[1])+ap*1.5
    r2=V[L].copy(); r2[:,[0,2]]=c[[0,2]]+(V[L][:,[0,2]]-c[[0,2]])*0.86; r2[:,1]=c[1]+ap*3.0
    V2=np.vstack([V,r1,r2]); m=len(L); Q2=list(map(list,Q))
    for j in range(m):
        a,b=L[j],L[(j+1)%m]; a1,b1=n+j,n+(j+1)%m; a2,b2=n+m+j,n+m+(j+1)%m
        Q2.append([b,a,a1,b1]); Q2.append([b1,a1,a2,b2])      # boundary edges run a->b in the neighbouring face, so the new face runs b->a
    return V2,np.array(Q2)
def smooth(V,Q):
    V2,Q2=cc.catmull_clark(*cc.catmull_clark(V,Q)); return V2,geo.orient_out(V2,cc.tris(Q2))
A=arch.arches(); ROW={}
for row,ap in [('top',1),('bottom',-1)]:
    T=A[row]['teeth']; teeth=[]
    for i in range(8):
        V,Q=T[7-i]; zen=(V[cc.boundary_loop(Q)][:,1]*ap).max()*ap      # the gum-ward peak of the crown's end
        V,Q=extend_root(V,Q,ap); S,F=smooth(V,Q)
        teeth.append({'V':V,'Q':Q,'S':S,'F':F,'zen':zen,'tip':(S[:,1]*-ap).max()*-ap})
    # seat the teeth: the central touches its twin at the midline, then each tooth slides along the arch until it touches the one before
    EPS=0.03
    t0=teeth[0]; dx=EPS/2-t0['S'][:,0].min(); t0['V'][:,0]+=dx; t0['S'][:,0]+=dx
    for i in range(1,8):
        a=teeth[i-1]; b=teeth[i]; ca=(a['S'].min(0)+a['S'].max(0))/2; cb=(b['S'].min(0)+b['S'].max(0))/2; d=ca-cb; d[1]=0; d/=np.linalg.norm(d)
        back=4.0; t=geo.touch(b['S']-d*back,b['F'],a['S'],a['F'],d); mv=d*(t-back-EPS)
        b['V']+=mv; b['S']+=mv
        print(row,'tooth',i,'moved %.3f mm along the arch'%(t-back-EPS),'-> clearance %.3f'%geo.min_dist(b['S'],b['F'],a['S'],a['F']))
    ROW[row]=teeth
import pickle; pickle.dump(ROW,open('seated.pkl','wb')); print('seated')
