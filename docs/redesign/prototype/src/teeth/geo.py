import numpy as np
def tri_normals(V,F):
    n=np.cross(V[F[:,1]]-V[F[:,0]],V[F[:,2]]-V[F[:,0]]); a=np.linalg.norm(n,axis=1); return n/np.maximum(a,1e-12)[:,None], a/2
def orient_out(V,F):
    """make triangles face outward (mesh may be open at one end)"""
    c=V.mean(0); vol=np.einsum('ij,ij->',V[F[:,0]]-c,np.cross(V[F[:,1]]-c,V[F[:,2]]-c))
    return F if vol>0 else F[:,[0,2,1]]
def vert_normals(V,F):
    n=np.cross(V[F[:,1]]-V[F[:,0]],V[F[:,2]]-V[F[:,0]]); N=np.zeros_like(V)
    for k in range(3): np.add.at(N,F[:,k],n)
    return N/np.maximum(np.linalg.norm(N,axis=1),1e-12)[:,None]
def ray_first(O,D,V,F,chunk=64):
    """nearest hit distance for rays O[i] + t D[i]; inf when none"""
    A=V[F[:,0]]; E1=V[F[:,1]]-A; E2=V[F[:,2]]-A; out=np.full(len(O),np.inf)
    for s in range(0,len(O),chunk):
        o=O[s:s+chunk]; d=D[s:s+chunk]
        P=np.cross(d[:,None,:],E2[None,:,:]); det=(E1[None]*P).sum(2); ok=np.abs(det)>1e-12; inv=np.where(ok,1/np.where(ok,det,1),0)
        Tv=o[:,None,:]-A[None]; u=(Tv*P).sum(2)*inv; Qv=np.cross(Tv,E1[None]); v=(Qv*d[:,None,:]).sum(2)*inv; t=(E2[None]*Qv).sum(2)*inv
        m=ok&(u>=-1e-9)&(v>=-1e-9)&(u+v<=1+1e-9)&(t>1e-9); t=np.where(m,t,np.inf); out[s:s+chunk]=t.min(1)
    return out
def touch(VA,FA,VB,FB,d):
    """how far A can travel along unit direction d before it first touches B (negative: already overlapping by about that much is not detected; start separated)"""
    NA=vert_normals(VA,FA); NB=vert_normals(VB,FB)
    ia=np.where(NA@d>0.05)[0]; ib=np.where(NB@d<-0.05)[0]
    nb,_=tri_normals(VB,FB); na,_=tri_normals(VA,FA)
    t1=ray_first(VA[ia],np.tile(d,(len(ia),1)),VB,FB[nb@d<0.05])
    t2=ray_first(VB[ib],np.tile(-d,(len(ib),1)),VA,FA[na@d>-0.05])
    return min(t1.min() if len(t1) else np.inf, t2.min() if len(t2) else np.inf)
def pt_tri_dist(P,V,F,chunk=256):
    """distance from each point to the triangle mesh"""
    A=V[F[:,0]]; B=V[F[:,1]]; C=V[F[:,2]]; out=np.full(len(P),np.inf)
    AB=B-A; AC=C-A
    for s in range(0,len(P),chunk):
        p=P[s:s+chunk][:,None,:]; AP=p-A[None]
        d1=(AB[None]*AP).sum(2); d2=(AC[None]*AP).sum(2)
        BP=p-B[None]; d3=(AB[None]*BP).sum(2); d4=(AC[None]*BP).sum(2)
        CP=p-C[None]; d5=(AB[None]*CP).sum(2); d6=(AC[None]*CP).sum(2)
        va=d3*d6-d5*d4; vb=d5*d2-d1*d6; vc=d1*d4-d3*d2
        den=va+vb+vc; den=np.where(np.abs(den)<1e-20,1e-20,den)
        v=vb/den; w=vc/den
        Q=A[None]+AB[None]*v[...,None]+AC[None]*w[...,None]      # interior
        # regions
        def setq(mask,val):
            nonlocal Q; Q=np.where(mask[...,None],val,Q)
        t=np.clip(d1/np.where(np.abs(d1-d3)<1e-20,1e-20,(d1-d3)),0,1); setq((vc<=0)&(d1>=0)&(d3<=0),A[None]+AB[None]*t[...,None])
        t=np.clip(d2/np.where(np.abs(d2-d6)<1e-20,1e-20,(d2-d6)),0,1); setq((vb<=0)&(d2>=0)&(d6<=0),A[None]+AC[None]*t[...,None])
        t=np.clip((d4-d3)/np.where(np.abs((d4-d3)+(d5-d6))<1e-20,1e-20,((d4-d3)+(d5-d6))),0,1); setq((va<=0)&((d4-d3)>=0)&((d5-d6)>=0),B[None]+(C-B)[None]*t[...,None])
        setq((d1<=0)&(d2<=0),np.broadcast_to(A[None],Q.shape)); setq((d3>=0)&(d4<=d3),np.broadcast_to(B[None],Q.shape)); setq((d6>=0)&(d5<=d6),np.broadcast_to(C[None],Q.shape))
        out[s:s+chunk]=np.sqrt(((p-Q)**2).sum(2)).min(1)
    return out
def min_dist(VA,FA,VB,FB,reach=3.0):
    """smallest distance between two meshes, looked for only where they come within `reach`"""
    lo=np.maximum(VA.min(0),VB.min(0))-reach; hi=np.minimum(VA.max(0),VB.max(0))+reach
    if (lo>hi).any(): return np.inf
    ia=np.where(((VA>=lo)&(VA<=hi)).all(1))[0]; ib=np.where(((VB>=lo)&(VB<=hi)).all(1))[0]
    if not len(ia) or not len(ib): return np.inf
    fb=FB[np.isin(FB,ib).any(1)]; fa=FA[np.isin(FA,ia).any(1)]
    d1=pt_tri_dist(VA[ia],VB,fb).min() if len(fb) else np.inf; d2=pt_tri_dist(VB[ib],VA,fa).min() if len(fa) else np.inf
    return min(d1,d2)
