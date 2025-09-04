self.onmessage = function(e) {
  const { chunk, timeChunk, width, x0, x1 } = e.data;
  const buckets = new Float64Array(width * 2);
  for (let i = 0; i < width; i++) {
    buckets[i * 2] = Infinity;     // minY
    buckets[i * 2 + 1] = -Infinity; // maxY
  }

  const k = (width - 1) / (x1 - x0);

  for (let i = 0; i < chunk.length; i ++) {     // 遍历所有点来填充buckets数组  
    const x = timeChunk[i];
    const y = chunk[i];
    const col = Math.round((x - x0) * k);   // 找到bucket的索引
    if (col < 0 || col >= width) continue;    // 超出范围
    const idx = col * 2;                     // bucket的索引
    if (y < buckets[idx]) buckets[idx] = y;
    if (y > buckets[idx + 1]) buckets[idx + 1] = y;
  }
  self.postMessage(buckets);
};