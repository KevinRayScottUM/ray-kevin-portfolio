import {tf,Trace,weights,imageInput,activate} from './common.js';
export function cnn(input,options={}){
  return tf.tidy(()=>{
    const n=12,size=options.kernelSize||3,stride=options.stride||1,padding=options.padding||'same',filter=options.filter||'edge',scale=options.kernelScale??1,t=new Trace('cnn'),x=tf.tensor4d(input||imageInput(options.preset),[1,n,n,1]);
    const coefficients=Array.from({length:size*size},(_,i)=>filter==='blur'?1/(size*size):filter==='sharpen'?(i===Math.floor(size*size/2)?size*size:-1):i%size===0?-1:i%size===size-1?1:0),kernel=tf.tensor4d(coefficients.map(v=>v*scale),[size,size,1,1]),conv=tf.conv2d(x,kernel,stride,padding).add(options.bias||0),a=activate(conv,options.activation||'relu'),pool=options.pool==='average'?tf.avgPool(a,2,2,'valid'):tf.maxPool(a,2,2,'valid'),k2=weights([3,3,1,2],75,.2),features=tf.relu(tf.conv2d(pool,k2,1,'same')),summary=features.mean([1,2]);
    for(const [id,v]of Object.entries({input:x,kernel,conv,activation:a,pool,features,summary}))t.record(id,v,id==='kernel'?'weight':id==='input'?'input':'activation');
    t.step('input',['Image','图像'],['Local 12x12 grayscale image; uploaded images are downsampled locally.','本地 12×12 灰度图；上传图片仅在本地降采样。'],String.raw`X\in\mathbb R^{12\times12}`,[],['input']);
    t.step('conv',['Convolution','卷积'],['Cross-correlation with the displayed kernel, stride and padding.','按所示卷积核、步幅与填充计算互相关。'],String.raw`Y_{ij}=b+\sum_{u,v}K_{uv}X_{si+u,sj+v}`,['input'],['kernel','conv']);
    t.step('activation',['Activation','激活'],['Apply the selected nonlinearity to every convolution output.','逐元素应用所选非线性激活。'],String.raw`A=\phi(Y)`,['conv'],['activation']);
    t.step('pool',['Pooling','池化'],['Non-overlapping 2x2 windows, maximum or average.','不重叠的 2×2 窗口，取最大值或平均值。'],options.pool==='average'?String.raw`P=\operatorname{AvgPool}_{2\times2}(A)`:String.raw`P=\operatorname{MaxPool}_{2\times2}(A)`,['activation'],['pool']);
    t.step('features',['Feature extraction','特征提取'],['Second convolution has two untrained filters. This is not object classification.','第二层含两个未训练滤波器，不具备物体分类能力。'],String.raw`F=\operatorname{ReLU}(P*K_2)`,['pool'],['features']);
    t.step('summary',['Channel summary','通道汇总'],['Spatial means of actual feature maps; not class probabilities.','真实特征图的空间均值，并非类别概率。'],String.raw`s_c=\operatorname{mean}_{i,j}F_{ijc}`,['features'],['summary']);
    t.parameters=kernel.size+k2.size;t.visual={kind:'vision',side:n,channels:2,kernelSize:size,stride,padding};return t;
  });
}
export function unet(input,options={}){
  return tf.tidy(()=>{
    const t=new Trace('unet'),x=tf.tensor4d(input||imageInput(options.preset,16),[1,16,16,1]),conv=(value,out,seed)=>{const kernel=weights([3,3,value.shape[3],out],seed,.15);t.parameters+=kernel.size;return tf.relu(tf.conv2d(value,kernel,1,'same'));},e1=conv(x,2,1),d1=tf.maxPool(e1,2,2,'valid'),e2=conv(d1,4,2),d2=tf.maxPool(e2,2,2,'valid'),b=conv(d2,8,3),up2=tf.image.resizeNearestNeighbor(b,[8,8]),skip2=options.skip===false?tf.zerosLike(e2):e2,merge2=tf.concat([up2,skip2],3),decode2=conv(merge2,4,4),up1=tf.image.resizeNearestNeighbor(decode2,[16,16]),skip1=options.skip===false?tf.zerosLike(e1):e1,merge1=tf.concat([up1,skip1],3),decode1=conv(merge1,2,5),kernel=weights([1,1,2,1],6,.5),output=tf.sigmoid(tf.conv2d(decode1,kernel,1,'same'));t.parameters+=kernel.size;
    for(const [id,v]of Object.entries({input:x,encoder1:e1,down1:d1,encoder2:e2,down2:d2,bottleneck:b,up2,merge2,decoder2:decode2,up1,merge1,decoder1:decode1,output}))t.record(id,v,id==='input'?'input':'activation');
    const descriptions=[['input','Image','图像',String.raw`X\in\mathbb R^{16\times16\times1}`,[]],['encoder1','Encoder 1','编码器 1',String.raw`E_1=\operatorname{ReLU}(X*K_1)`,['input']],['encoder2','Encoder 2','编码器 2',String.raw`E_2=\operatorname{ReLU}(\operatorname{Pool}(E_1)*K_2)`,['encoder1']],['bottleneck','Bottleneck','瓶颈',String.raw`B=\operatorname{ReLU}(\operatorname{Pool}(E_2)*K_B)`,['encoder2']],['decoder2','Decoder 2','解码器 2',String.raw`D_2=\operatorname{ReLU}([\operatorname{Up}(B),E_2]*K_D)`,['bottleneck','encoder2']],['decoder1','Decoder 1','解码器 1',String.raw`D_1=\operatorname{ReLU}([\operatorname{Up}(D_2),E_1]*K_D)`,['decoder2','encoder1']],['output','Pixel output','像素输出',String.raw`P=\sigma(D_1*K_{1\times1})`,['decoder1']]];
    for(const [id,en,zh,formula,ins]of descriptions)t.step(id,[en,zh],['Untrained U-shaped network; output is an activation map, not a medical or semantic segmentation. Skip-off replaces the skip features with zeros.','未训练 U 型网络；输出仅为激活图，并非医学或语义分割。关闭跳连时，跳连特征用零替代。'],formula,ins,id==='decoder2'?['up2','merge2','decoder2']:id==='decoder1'?['up1','merge1','decoder1']:[id]);
    t.visual={kind:'unet',skip:options.skip!==false};return t;
  });
}
