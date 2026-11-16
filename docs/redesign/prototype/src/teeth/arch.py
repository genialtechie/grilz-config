import numpy as np, host, cc
def kabsch(A,B):
    ca=A.mean(0); cb=B.mean(0); H=(A-ca).T@(B-cb); U,S,Vt=np.linalg.svd(H); d=np.sign(np.linalg.det(Vt.T@U.T)); R=Vt.T@np.diag([1,1,d])@U.T
    return R,cb-R@ca
def Rx(a): c,s=np.cos(a),np.sin(a); return np.array([[1,0,0],[0,c,-s],[0,s,c]])
def Ry(a): c,s=np.cos(a),np.sin(a); return np.array([[c,0,s],[0,1,0],[-s,0,c]])
def mould(row,a):
    import glb
    M=glb.load(); P,F=M[row+'_mould']; P=P*a['sc']; P[:,0]-=a['mid']
    V=P@a['Rsym'].T; V[:,0]-=a['d0']; V=V@a['Rl'].T
    return V,F
def ray_hits(O,D,V,F):
    """nearest hit distance of each ray (O[i], D[i]) with triangle mesh; inf when none"""
    A=V[F[:,0]]; E1=V[F[:,1]]-A; E2=V[F[:,2]]-A; out=np.full(len(O),np.inf)
    for i in range(len(O)):
        d=D[i]; P=np.cross(d,E2); det=(E1*P).sum(1); ok=np.abs(det)>1e-12; inv=np.where(ok,1/np.where(ok,det,1),0)
        Tv=O[i]-A; u=(Tv*P).sum(1)*inv; Qv=np.cross(Tv,E1); v=(Qv@d)*inv; t=(E2*Qv).sum(1)*inv
        m=ok&(u>=-1e-9)&(v>=-1e-9)&(u+v<=1+1e-9)&(t>1e-9)
        if m.any(): out[i]=t[m].min()
    return out
def arches():
    """both hosted arches made upright: mirror-symmetric about x = 0 and with the biting plane level. Returns {row: [ (V,Q) for teeth 1..8 from the back molar to the central incisor, on the x > 0 side ]}"""
    T,mids,sc=host.hosted(); out={}
    for row in ['top','bottom']:
        names=['%s_teeth.%03d'%(row,k) for k in range(1,17)]
        A=np.vstack([T[n][0] for n in names[:8]]); B=np.vstack([T[n][0] for n in names[:7:-1]])*np.array([-1,1,1])
        # the left side mirrored is the right side moved rigidly: find that move (same vertex order is not assumed)
        R=np.eye(3); t=B.mean(0)-A.mean(0)
        for it in range(60):
            X=A@R.T+t; j=np.empty(len(A),int)
            for s in range(0,len(A),400): j[s:s+400]=((X[s:s+400,None,:]-B[None,:,:])**2).sum(2).argmin(1)
            R,t=kabsch(A,B[j])
        Mx=np.diag([-1.,1,1]); L=Mx@R; tt=Mx@t      # the model's own mirror: p -> L p + tt
        w,v=np.linalg.eig(L); n=np.real(v[:,np.argmin(np.abs(w+1))]); n/=np.linalg.norm(n)
        if n[0]<0: n=-n
        c=tt/2                                  # a point on the mirror plane (the plane passes through tt/2 along n)
        d0=n@c
        # turn the model so the mirror plane is x = 0
        yaw=np.arctan2(n[2],n[0]); Rz_=np.eye(3)
        Rfix=Ry(yaw)                              # rotates n into the xy-plane
        n2=Rfix@n; roll=np.arctan2(n2[1],n2[0]); c_,s_=np.cos(-roll),np.sin(-roll); Rroll=np.array([[c_,-s_,0],[s_,c_,0],[0,0,1]])
        Rsym=Rroll@Rfix
        teeth=[]
        for nme in names:
            V,Q=T[nme]; V2=(V@Rsym.T); V2[:,0]-=d0; teeth.append([V2,Q])
        # level the biting plane: fit tips y = a + b z
        tips=[]
        for V,Q in teeth:
            i=np.argmin(V[:,1]) if row=='top' else np.argmax(V[:,1]); cz=(V[:,2].min()+V[:,2].max())/2; tips.append([V[i,1],cz])
        tips=np.array(tips); b,a=np.polyfit(tips[:,1],tips[:,0],1); ang=np.arctan(b)
        Rl=Rx(ang)
        for tv in teeth: tv[0]=tv[0]@Rl.T
        out[row]={'teeth':teeth,'yaw':np.degrees(yaw),'roll':np.degrees(roll),'pitch':np.degrees(ang),'R':Rl@Rsym,'d0':d0,'mid':mids[row],'sc':sc,'Rl':Rl,'Rsym':Rsym}
    return out
if __name__=='__main__':
    np.set_printoptions(suppress=True, linewidth=220)
    A=arches()
    for row in ['top','bottom']:
        a=A[row]; print(row,'yaw %.2f roll %.2f pitch %.2f'%(a['yaw'],a['roll'],a['pitch']))
        for k in range(16):
            V,Q=a['teeth'][k]; c=(V.min(0)+V.max(0))/2
            tip=V[:,1].min() if row=='top' else V[:,1].max()
            print('  %2d centre %s size %s tip y %.2f'%(k+1,np.round(c,2),np.round(np.ptp(V,axis=0),2),tip))
