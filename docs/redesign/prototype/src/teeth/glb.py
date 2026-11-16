import json, struct, os, numpy as np
GLB=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','..','..','..','public','assets','teeth_final.glb')
def load(path=GLB):
    d=open(path,'rb').read()
    jl=struct.unpack('<I',d[12:16])[0]; j=json.loads(d[20:20+jl]); bin_=d[20+jl+8:]
    def acc(i):
        a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]
        off=bv.get('byteOffset',0)+a.get('byteOffset',0); n=a['count']
        dt={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']]; k={'VEC3':3,'SCALAR':1,'VEC2':2}[a['type']]
        size=np.dtype(dt).itemsize*k; stride=bv.get('byteStride',size)
        if stride==size: return np.frombuffer(bin_,dtype=dt,count=n*k,offset=off).reshape(n,k).astype(np.float64)
        out=np.zeros((n,k))
        for r in range(n): out[r]=np.frombuffer(bin_,dtype=dt,count=k,offset=off+r*stride)
        return out
    def mat(n):
        if 'matrix' in n: return np.array(n['matrix']).reshape(4,4).T
        T=np.eye(4); R=np.eye(4); S=np.eye(4)
        if 'translation' in n: T[:3,3]=n['translation']
        if 'rotation' in n:
            x,y,z,w=n['rotation']; R[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
        if 'scale' in n: S[0,0],S[1,1],S[2,2]=n['scale']
        return T@R@S
    parent={}
    for i,n in enumerate(j['nodes']):
        for c in n.get('children',[]): parent[c]=i
    def world(i):
        M=mat(j['nodes'][i])
        while i in parent: i=parent[i]; M=mat(j['nodes'][i])@M
        return M
    out={}
    for i,n in enumerate(j['nodes']):
        nm=n.get('name','')
        if 'mesh' not in n: continue
        prim=j['meshes'][n['mesh']]['primitives'][0]
        P=acc(prim['attributes']['POSITION']); W=world(i); P=(W[:3,:3]@P.T).T+W[:3,3]
        F=acc(prim['indices']).astype(int).reshape(-1,3) if 'indices' in prim else np.arange(len(P)).reshape(-1,3)
        out[nm]=(P,F)
    return out
