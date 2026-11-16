import numpy as np
def weld(P,F,dec=4):
    key=np.round(P,dec); uniq,inv=np.unique(key,axis=0,return_inverse=True)
    return uniq.astype(float), inv[F]
def quads_from_tris(Fw):
    Q=[]
    for k in range(0,len(Fw),2):
        a=list(Fw[k]); b=list(Fw[k+1]); sh=set(a)&set(b)
        assert len(sh)==2
        # vertex of a not shared, ordered loop: a's order with b's unique vertex inserted between the two shared verts where they're adjacent in a
        ub=[v for v in b if v not in sh][0]
        for i in range(3):
            if a[i] in sh and a[(i+1)%3] in sh:
                q=[a[(i+2)%3],a[i],ub,a[(i+1)%3]]; break
        Q.append(q)
    return np.array(Q)
def catmull_clark(V,Q):
    V=np.asarray(V,float); nV=len(V); nQ=len(Q)
    fp=V[Q].mean(1)
    edges={}; 
    for fi,q in enumerate(Q):
        for i in range(4):
            a,b=q[i],q[(i+1)%4]; e=(min(a,b),max(a,b)); edges.setdefault(e,[]).append(fi)
    eidx={e:i for i,e in enumerate(edges)}
    ep=np.zeros((len(edges),3)); 
    vfaces=[[] for _ in range(nV)]; vedges=[[] for _ in range(nV)]
    for fi,q in enumerate(Q):
        for v in q: vfaces[v].append(fi)
    bverts=set()
    for e,fs in edges.items():
        i=eidx[e]; a,b=e; vedges[a].append(e); vedges[b].append(e)
        if len(fs)==2: ep[i]=(V[a]+V[b]+fp[fs[0]]+fp[fs[1]])/4
        else: ep[i]=(V[a]+V[b])/2; bverts.add(a); bverts.add(b)
    nv=np.zeros_like(V)
    for v in range(nV):
        if v in bverts:
            be=[e for e in vedges[v] if len(edges[e])==1]
            o=[ (e[0] if e[1]==v else e[1]) for e in be]
            nv[v]=0.75*V[v]+0.125*(V[o[0]]+V[o[1]]) if len(o)==2 else V[v]
        else:
            n=len(vfaces[v]); Fm=fp[vfaces[v]].mean(0); Rm=np.mean([(V[e[0]]+V[e[1]])/2 for e in vedges[v]],axis=0)
            nv[v]=(Fm+2*Rm+(n-3)*V[v])/n
    NV=np.vstack([nv,fp,ep]); NQ=[]
    for fi,q in enumerate(Q):
        for i in range(4):
            a=q[i]; b=q[(i+1)%4]; p=q[(i-1)%4]
            NQ.append([a, nV+nQ+eidx[(min(a,b),max(a,b))], nV+fi, nV+nQ+eidx[(min(a,p),max(a,p))]])
    return NV,np.array(NQ)
def tris(Q): return np.vstack([Q[:,[0,1,2]],Q[:,[0,2,3]]])
def boundary_loop(Q):
    edges={}
    for q in Q:
        for i in range(4):
            a,b=q[i],q[(i+1)%4]; edges.setdefault((min(a,b),max(a,b)),[]).append((a,b))
    nxt={}
    for e,l in edges.items():
        if len(l)==1: a,b=l[0]; nxt[a]=b
    if not nxt: return []
    s=next(iter(nxt)); loop=[s]; v=nxt[s]
    while v!=s: loop.append(v); v=nxt[v]
    return loop
