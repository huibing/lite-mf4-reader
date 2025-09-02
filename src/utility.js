import * as d3 from 'd3';

export const calcDataXExtent = (data) => {
    const keys = Object.keys(data);
    let min = Infinity;
    let max = -Infinity;
    keys.forEach(key => {
        const x_domain = data[key]["x_domain"];
        if (x_domain[0] < min) min = x_domain[0];
        if (x_domain[1] > max) max = x_domain[1];
    })
    return [min, max];
}

export const calcDataYExtent = (data) => {
    let min = Infinity;
    let max = -Infinity;
    const keys = Object.keys(data);
    keys.forEach(key => {
        const y_domain = data[key]["y_domain"];
        if (y_domain[0] < min) min = y_domain[0];
        if (y_domain[1] > max) max = y_domain[1];
    });
    return [min, max];
}

export function calcDataYextWithinX(data, xDomain) {   // this function will cost time for large data
    const keys = Object.keys(data);
    let min = Infinity;
    let max = -Infinity;
    for (let k of keys) {
      const [xMinIndex, xMaxIndex] = findRange(data[k].time, xDomain);   // 找到x轴范围内的数据索引
      const yData = data[k].pathData.map(d => d[1]).slice(xMinIndex, xMaxIndex + 1);   // 提取y轴范围内的数据
      const yDomain = d3.extent(yData);   // 计算y轴范围
      if (yDomain[0] < min) min = yDomain[0];
      if (yDomain[1] > max) max = yDomain[1];
    }
    return [min, max];
}

export function calcYextWithinX(arr, xDomain, timeArray) {
  const [xMinIndex, xMaxIndex] = findRange(timeArray, xDomain);
  const yData = arr.map(d => d[1]).slice(xMinIndex, xMaxIndex + 1);
  return d3.extent(yData);
}

export function generateColorWheelColors(count = 12) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.round((360 / count) * i); // 均匀分布角度
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
}

export function interpolateYCoordinate(data, xValue) {
  const dataLen = data.length;
  if (dataLen === 0) return null;
  if (dataLen === 1) return y[0];

  // assuming data is sorted by xValue
  if (xValue <= data[0][0]) {
    return data[0][1];
  }
  if (xValue >= data[dataLen - 1][0]) {
    return data[dataLen - 1][1];
  }

  // 二分查找区间
  let low = 0;
  let high = dataLen - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midX = data[mid][0];

    if (midX === xValue) {
      return data[mid][1]; // 刚好匹配
    } else if (midX < xValue) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // high 是左端点索引，low 是右端点索引
  const x0 = data[high][0];
  const y0 = data[high][1];
  const x1 = data[low][0];
  const y1 = data[low][1];

  // 线性插值
  return y0 + (y1 - y0) * (xValue - x0) / (x1 - x0);
}

export function isXinRange(xValue, data) {
  return xValue >= data[0] && xValue <= data.at(-1);
}

export async function generateUUID(fileName, signalName) {
  const text = fileName + "::" + signalName; // 拼接两段字符串
  const data = new TextEncoder().encode(text);

  // 计算 SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // 取前16字节拼成 UUID v4 格式
  hashArray[6] = (hashArray[6] & 0x0f) | 0x40; // UUID 版本号 v4
  hashArray[8] = (hashArray[8] & 0x3f) | 0x80; // UUID variant

  const hex = hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) + "-" +
    hex.slice(8, 12) + "-" +
    hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" +
    hex.slice(20)
  );
}

function lowerBound(arr, target) {
  let left = 0, right = arr.length; // [left, right)
  while (left < right) {
    const mid = (left + right) >> 1;
    if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left; // 第一个 >= target 的位置
}

function upperBound(arr, target) {
  let left = 0, right = arr.length; // [left, right)
  while (left < right) {
    const mid = (left + right) >> 1;
    if (arr[mid] <= target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left; // 第一个 > target 的位置
}

export function findRangeAuto(arr, xDomain) {
  const start = lowerBound(arr, xDomain[0]);
  const end = upperBound(arr.slice(start), xDomain[1]) - 1;
  if (start <= end && start < arr.length) {
    return [start, end]; // 索引范围
  }
  return [0, arr.length - 1]; // 默认返回整个数组避免错误
}

export function findRange(arr, xDomain) {
  const n = arr.length;
  if (n === 0) return [0, -1];
  if (n === 1) return [0, 0];

  const [xmin, xmax] = xDomain;

  // === Step 1: 检查是不是等差数列 ===
  const d1 = arr[1] - arr[0];
  let isArithmetic = true;
  // 只抽查几个点，避免全数组 O(n) 检查
  const sampleCount = Math.min(n - 1, 5);  
  for (let i = 1; i <= sampleCount; i++) {
    if ( floatEqualEst(arr[i] - arr[i - 1], d1)) {
      isArithmetic = false;
      break;
    }
  }

  if (isArithmetic) {
    // === Step 2: 直接用公式计算 O(1) ===
    console.log("Arithmetic progression detected.");
    let start = Math.ceil((xmin - arr[0]) / d1);
    let end   = Math.floor((xmax - arr[0]) / d1);

    if (start < 0) start = 0;
    if (end >= n) end = n - 1;

    if (start <= end) return [start, end];
    return [0, n - 1];
  }

  // === Step 3: 回退到二分查找 ===
  const start = lowerBound(arr, xmin);
  let end = upperBound(arr, xmax) - 1;
  if (end >= n) end = n - 1;

  if (start <= end) return [start, end];
  return [0, n - 1];
}

function floatEqualEst(a, b) {  // 近似相等即可，用于浮点数比较
  if (a === b) return true;
  if (a === 0) {
    return Math.abs(b) < 1e-4;
  } else if (b === 0) {
    return Math.abs(a) < 1e-4;
  } else {
    return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) < 1e-3;
  }
}

// 按像素列聚合：每个 x 像素保留 yMin、yMax
export function downsamplePerPixel(points, width, xScale) {
  const buckets = Array.from({length: width}, () => [Infinity, -Infinity]);
  const x0 = xScale.domain()[0], x1 = xScale.domain()[1];
  const k = (width - 1) / (x1 - x0);     // 像素/单位长度   单位长度上面的像素数量

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const col = Math.round((p[0] - x0) * k);
    if (col < 0 || col >= width) continue;
    if (p[1] < buckets[col][0]) buckets[col][0] = p[1];
    if (p[1] > buckets[col][1]) buckets[col][1] = p[1];
  }

  const reduced = [];
  for (let col = 0; col < width; col++) {
    const [minY, maxY] = buckets[col];
    if (minY !== Infinity) {
      // 注意顺序：画一根细“竖线”，视觉上接近原曲线外包络
      reduced.push([xScale.invert(col), minY]);
      if (maxY !== minY) reduced.push([xScale.invert(col), maxY]);
    }
  }
  return reduced;
}


export async function downsampleParallel(points, width, x0, x1, maxWorkers) {   // 并行计算
  // 动态选择 Worker 数：默认 CPU 核数，至少 1
  const numWorkers = Math.min(
    maxWorkers || navigator.hardwareConcurrency || 4,
    points.length // 不要超过点数
  );

  const chunkSize = Math.ceil(points.length * 2 / numWorkers);
  const workers = [];
  const promises = [];
  const totalChunks = flattenPoints(points);

  for (let i = 0; i < numWorkers; i++) {
    const worker = new Worker("downsampleWorker.js");
    workers.push(worker);
    const start = i * chunkSize * 2;
    const end = Math.min(totalChunks.length, (i + 1) * chunkSize * 2);
    const chunk = totalChunks.subarray(start, end); // 不拷贝，subarray 是 view
    promises.push(new Promise(resolve => {
      worker.onmessage = e => {
        resolve(e.data);
        worker.terminate();
      };
    }));
    worker.postMessage({ points: chunk, width, x0, x1 });
  }

  const results = await Promise.all(promises);
  // 合并桶结果
  const buckets = new Float64Array(width * 2);
  for (let i = 0; i < width; i++) {
    buckets[i * 2] = Infinity;
    buckets[i * 2 + 1] = -Infinity;
  }

  for (const partial of results) {
    for (let i = 0; i < width; i++) {
      const idx = i * 2;
      if (partial[idx] < buckets[idx]) buckets[idx] = partial[idx];
      if (partial[idx + 1] > buckets[idx + 1]) buckets[idx + 1] = partial[idx + 1];
    }
  }

  // 生成最终的 (x, y)
  const invK = (x1 - x0) / (width - 1);
  const reduced = [];
  for (let col = 0; col < width; col++) {
    const minY = buckets[col * 2];
    const maxY = buckets[col * 2 + 1];
    if (minY !== Infinity) {
      const x = x0 + col * invK;
      reduced.push([x, minY]);
      if (maxY !== minY) reduced.push([x, maxY]);
    }
  }
  return reduced;
}


function flattenPoints(points) {
  const flat = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    flat[i * 2] = points[i][0];
    flat[i * 2 + 1] = points[i][1];
  }
  return flat;
}

export function downsampleQuick(points, width) {  // 快速计算画图
  const step = Math.floor(points.length / (width - 1)) ;   // 每个像素对应的x轴范围
  const reduced = []; // 每个像素对应的y轴范围
  for (let i = 0; i < points.length; i+=step) {
    reduced.push([points[i][0], points[i][1]]);  // quick sampling for initial display only, will be replaced by downsampleParallel later
  }
  return reduced;
}