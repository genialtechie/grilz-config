import numpy as np, glb, cc
def hosted():
    """hosted teeth in mm, x measured from the midline between the central incisors; returns {name: (V, Q)} with welded verts and quads"""
    M=glb.load()
    allp=np.vstack([M[k][0] for k in M if 'teeth.' in k]); sc=62/np.ptp(allp[:,0])
    T={}
    for nm,(P,F) in M.items():
        if 'teeth' not in nm: continue
        V,Fw=cc.weld(P*sc,F); T[nm]=(V,cc.quads_from_tris(Fw))
    # midline: between the two centrals' facing extremes, for each arch separately
    mids={}
    for row in ['top','bottom']:
        a=T[row+'_teeth.008'][0]; b=T[row+'_teeth.009'][0]
        mids[row]=(a[:,0].min()+b[:,0].max())/2
    out={}
    for nm,(V,Q) in T.items():
        row=nm.split('_')[0]; V=V.copy(); V[:,0]-=mids[row]; out[nm]=(V,Q)
    return out,mids,sc
if __name__=='__main__':
    T,mids,sc=hosted(); print('midlines',mids,'scale',sc)
    for row,sgn in [('top',-1),('bottom',1)]:
        tips=[]; 
        for k in range(1,17):
            V,Q=T['%s_teeth.%03d'%(row,k)]
            i=np.argmin(V[:,1]) if row=='top' else np.argmax(V[:,1])
            c=(V.min(0)+V.max(0))/2
            tips.append([c[0],V[i,1],c[2]])
        tips=np.array(tips)
        A=np.c_[np.ones(16),tips[:,2]]; coef,res,_,_=np.linalg.lstsq(A,tips[:,1],rcond=None)
        print(row,'tip plane y = %.2f + %.4f z'%tuple(coef),'angle deg',np.degrees(np.arctan(coef[1])))
        print('  residuals',np.round(tips[:,1]-A@coef,2))
        print('  x centres',np.round(tips[:,0],1))
